require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const helmet = require('helmet'); // הוספת הגנה על כותרות HTTP
const rateLimit = require('express-rate-limit'); // הגבלת קצב בקשות
const axios = require('axios');
const app = express();

// 1. הגנה על כותרות השרת (מונע חשיפת מידע טכני והתקפות נפוצות)
app.use(helmet());

// 2. הגבלת קצב בקשות - מונע מבוטים להציף את השרת או לנסות לנחש תעודות זהות
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // חלון זמן של 15 דקות
    max: 100, // מקסימום 100 בקשות מ-IP אחד בכל חלון זמן
    message: "יותר מדי בקשות מהכתובת הזו, אנא נסו שוב מאוחר יותר"
});
app.use('/api/', limiter); // החלת ההגבלה על כל נתיבי ה-API

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbConfig = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    authentication: {
        type: 'default',
        options: { userName: process.env.DB_USER, password: process.env.DB_PASSWORD }
    }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => { console.log('Connected to MSSQL'); return pool; })
    .catch(err => console.log('Database Connection Failed!', err));

// בדיקת קיום ילד
app.get('/api/check-child/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.NVarChar, req.params.id)
            .query('SELECT 1 FROM Children WHERE ChildIDNumber = @id');
        res.json({ exists: result.recordset.length > 0 });
    } catch (err) { res.status(500).send(err.message); }
});

// אימות ילד + שליפת פרטי משלם ומחזור - מעודכן לשליפה משולבת
app.post('/api/verify-child', async (req, res) => {
    const { id, birthDate, expectedLastName } = req.body; 
    try {
        const pool = await poolPromise;
        
        const result = await pool.request()
            .input('id', sql.NVarChar, id)
            .query(`
                SELECT TOP 1 
                    C.*, 
                    R.PayerID, 
                    R.PayerName,
                    R.PayerID2,
                    R.PayerName2,
                    R.CampCycle
                FROM Children C
                LEFT JOIN Registrations R ON C.ChildID = R.ChildID
                WHERE C.ChildIDNumber = @id
                ORDER BY R.CreatedAt DESC
            `);
        
        if (result.recordset.length === 0) return res.status(404).send("Not Found");
        
        const child = result.recordset[0];
        const dbDate = new Date(child.BirthDate).toISOString().split('T')[0];
        
        if (dbDate !== birthDate) return res.status(401).send("Unauthorized");

        if (expectedLastName && child.LastName !== expectedLastName) {
            return res.status(400).send("שם המשפחה אינו תואם למשפחה הנרשמת");
        }
        
        if (child.PayerName) {
            const nameParts = child.PayerName.split(' ');
            child.payerFirstName = nameParts[0] || '';
            child.payerLastName = nameParts.slice(1).join(' ') || '';
        }

        if (child.PayerName2) {
            const nameParts2 = child.PayerName2.split(' ');
            child.payerFirstName2 = nameParts2[0] || '';
            child.payerLastName2 = nameParts2.slice(1).join(' ') || '';
        }

        const balanceRes = await pool.request()
            .input('fId', sql.NVarChar, child.FamilyID)
            .query(`
                SELECT 
                    SUM(ISNULL(R.ActualAmount, 0)) AS TotalPaid,
                    (SUM(ISNULL(R.ExpectedAmount, 0)) - SUM(ISNULL(R.ActualAmount, 0))) AS BalanceDue
                FROM Children C
                JOIN Registrations R ON C.ChildID = R.ChildID
                WHERE C.FamilyID = @fId
            `);
        
        const stats = balanceRes.recordset[0];
        const hasPaidSomething = (stats?.TotalPaid || 0) > 0;
        const hasDebt = (stats?.BalanceDue || 0) > 0;

        res.json({ 
            success: true, 
            details: child, 
            showDebtAlert: hasPaidSomething && hasDebt,
            balanceAmount: stats?.BalanceDue || 0
        });
    } catch (err) { res.status(500).send(err.message); }
});

// פונקציית הרישום המרכזית
app.post('/api/register', async (req, res) => {
    const d = req.body;

    if (!d.birthDate) return res.status(400).json({ error: "תאריך לידה הוא שדה חובה" });
    if (d.notes && d.notes.length > 200) return res.status(400).json({ error: "שדה הערות מוגבל ל-200 תווים" });

    try {
        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);
            
            let cycleText = "";
            if (d.campCycle === "1") cycleText = "מחזור א'";
            else if (d.campCycle === "2") cycleText = "מחזור ב'";
            else if (d.campCycle === "3" || (d.campCycle && d.campCycle.toString().includes('+'))) cycleText = "מחזור א' + ב'";
            else cycleText = d.campCycle || "לא צוין";

            request.input('idNum', sql.NVarChar, d.id);
            request.input('fName', sql.NVarChar, d.firstName);
            request.input('lName', sql.NVarChar, d.lastName);
            request.input('gender', sql.NVarChar, d.gender);
            request.input('city', sql.NVarChar, d.city);
            request.input('addr', sql.NVarChar, d.streetAddress);
            request.input('mail', sql.NVarChar, d.email);
            request.input('hFund', sql.NVarChar, d.healthFund === 'אחר' ? d.otherHealthFund : d.healthFund);
            request.input('schl', sql.NVarChar, d.school === 'אחר' ? d.otherSchool : d.school);
            request.input('grade', sql.NVarChar, d.finishedGrade);
            request.input('bDate', sql.Date, d.birthDate);
            request.input('allergies', sql.NVarChar, d.allergies === 'כן' ? d.allergiesDetail : 'לא');
            request.input('healthDecl', sql.NVarChar, d.healthDeclaration === 'יש מגבלות' ? d.healthDetail : 'בריא/ה');
            request.input('attractions', sql.NVarChar, d.attractions);
            request.input('swim', sql.NVarChar, d.swim); 
            request.input('retHome', sql.NVarChar, d.returnHome); 
            request.input('notes', sql.NVarChar, d.notes || '');
            request.input('p1N', sql.NVarChar, d.p1_Name);
            request.input('p1P', sql.NVarChar, d.p1_Phone);
            request.input('p2N', sql.NVarChar, d.p2_Name || null);
            request.input('p2P', sql.NVarChar, d.p2_Phone || null);
            request.input('emergP', sql.NVarChar, d.extraPhone);
            request.input('studP', sql.NVarChar, d.studentPhone || null);
            
            const familyID = d.familyID || d.id;
            request.input('familyID', sql.NVarChar, familyID); 

            request.input('payerID', sql.NVarChar, d.payerID);
            const fullPayerName = `${d.payerFirstName || ''} ${d.payerLastName || ''}`.trim();
            request.input('payerName', sql.NVarChar, fullPayerName);

            request.input('payerID2', sql.NVarChar, d.payerID2 || null);
            const fullPayerName2 = d.payerFirstName2 ? `${d.payerFirstName2} ${d.payerLastName2 || ''}`.trim() : null;
            request.input('payerName2', sql.NVarChar, fullPayerName2);

            request.input('campCycle', sql.NVarChar, cycleText); 

            let price = (cycleText === "מחזור א' + ב'") ? 2500 : 1350; 
            request.input('expectedAmt', sql.Decimal(10, 2), price);

            const checkChild = await request.query('SELECT ChildID FROM Children WHERE ChildIDNumber = @idNum');
            let childInternalID;

            if (checkChild.recordset.length > 0) {
                childInternalID = checkChild.recordset[0].ChildID;
                await request.query(`
                    UPDATE Children SET 
                        FirstName=@fName, LastName=@lName, Gender=@gender, City=@city, StreetAddress=@addr, 
                        Email=@mail, HealthFund=@hFund, School=@schl, FinishedGrade=@grade, BirthDate=@bDate,
                        Allergies=@allergies, HealthDeclaration=@healthDecl, AttractionsApproval=@attractions, 
                        SwimKnowledge=@swim, ReturnHome=@retHome, Notes=@notes, 
                        P1_Name=@p1N, P1_Phone=@p1P, P2_Name=@p2N, P2_Phone=@p2P, 
                        EmergencyPhone=@emergP, StudentPhone=@studP, FamilyID=@familyID
                    WHERE ChildIDNumber = @idNum`);
            } else {
                const insertRes = await request.query(`
                    INSERT INTO Children (
                        ChildIDNumber, FirstName, LastName, Gender, City, StreetAddress, Email, HealthFund, 
                        School, FinishedGrade, BirthDate, Allergies, HealthDeclaration, AttractionsApproval, 
                        SwimKnowledge, ReturnHome, Notes, P1_Name, P1_Phone, P2_Name, P2_Phone, EmergencyPhone, StudentPhone, FamilyID
                    ) 
                    OUTPUT INSERTED.ChildID 
                    VALUES (
                        @idNum, @fName, @lName, @gender, @city, @addr, @mail, @hFund, 
                        @schl, @grade, @bDate, @allergies, @healthDecl, @attractions, 
                        @swim, @retHome, @notes, @p1N, @p1P, @p2N, @p2P, @emergP, @studP, @familyID
                    )`);
                childInternalID = insertRes.recordset[0].ChildID;
            }

            request.input('internalID', sql.Int, childInternalID);
            await request.query(`
                IF EXISTS (SELECT 1 FROM Registrations WHERE ChildID = @internalID AND CampCycle = @campCycle)
                BEGIN
                    UPDATE Registrations SET 
                        PayerID = @payerID, 
                        PayerName = @payerName,
                        PayerID2 = @payerID2,
                        PayerName2 = @payerName2,
                        ExpectedAmount = @expectedAmt
                    WHERE ChildID = @internalID AND CampCycle = @campCycle
                END
                ELSE
                BEGIN
                    INSERT INTO Registrations (ChildID, CampCycle, PayerID, PayerName, PayerID2, PayerName2, Status, ExpectedAmount, ActualAmount, CreatedAt)
                    VALUES (@internalID, @campCycle, @payerID, @payerName, @payerID2, @payerName2, 'Pending', @expectedAmt, 0, GETDATE())
                END
            `);

            await transaction.commit();

            const summaryResult = await pool.request()
                .input('fId', sql.NVarChar, familyID)
                .query(`
                    SELECT 
                        COUNT(DISTINCT C.ChildID) AS NumberOfChildren,
                        SUM(ISNULL(R.ExpectedAmount, 0)) AS TotalExpected,
                        SUM(ISNULL(R.ActualAmount, 0)) AS TotalPaid,
                        (SUM(ISNULL(R.ExpectedAmount, 0)) - SUM(ISNULL(R.ActualAmount, 0))) AS BalanceDue
                    FROM Children C
                    JOIN Registrations R ON C.ChildID = R.ChildID
                    WHERE C.FamilyID = @fId
                `);

            res.json({ 
                success: true, 
                familyID: familyID, 
                summary: summaryResult.recordset[0] || null 
            });

        } catch (innerErr) {
            await transaction.rollback();
            throw innerErr;
        }
    } catch (err) { 
        console.error("Registration Error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

// שליפת סיכום תשלום משפחתי לפי FamilyID
app.get('/api/family-balance/:familyId', async (req, res) => {
    try {
        const pool = await poolPromise;
        const summary = await pool.request()
            .input('fId', sql.NVarChar, req.params.familyId)
            .query(`
                SELECT 
                    SUM(ISNULL(R.ExpectedAmount, 0)) AS TotalExpected,
                    SUM(ISNULL(R.ActualAmount, 0)) AS TotalPaid,
                    (SUM(ISNULL(R.ExpectedAmount, 0)) - SUM(ISNULL(R.ActualAmount, 0))) AS BalanceDue
                FROM Children C
                JOIN Registrations R ON C.ChildID = R.ChildID
                WHERE C.FamilyID = @fId
            `);

        const payers = await pool.request()
            .input('fId', sql.NVarChar, req.params.familyId)
            .query(`
                SELECT DISTINCT TOP 2 PayerID, PayerName, PayerID2, PayerName2
                FROM Registrations R
                JOIN Children C ON R.ChildID = C.ChildID
                WHERE C.FamilyID = @fId
                ORDER BY R.CreatedAt ASC
            `);

        res.json({
            ...summary.recordset[0],
            payers: payers.recordset,
            maxPayersReached: payers.recordset.length >= 2
        });
    } catch (err) { res.status(500).send(err.message); }
});

// יצירת דף תשלום מול Grow
const https = require('https'); // תוסיפי את השורה הזו למעלה אם היא לא קיימת
app.post('/api/create-payment', (req, res) => {
    // אנחנו מושכים את הנתונים שהגיעו מה-Frontend
    const { familyID, amountToPay, payerName, phone, email } = req.body;

    try {
        console.log("--- מעקף בטיחות מופעל ---");
        console.log(`יוצר קישור ישיר עבור משפחה: ${familyID}, סכום: ${amountToPay}`);

        // הכתובת הישירה לדף שלך במשולם (בלי API ובלי סנדבוקס שבור)
        const baseUrl = "https://meshulam.co.il/purchase/b73ca07591f8"; 

        // בניית הפרמטרים שיוצגו אוטומטית בדף התשלום
        const queryParams = new URLSearchParams({
            'pageCode': 'b73ca07591f8',
            'userId': '4ec1d595ae764243',
            'sum': amountToPay,
            'description': `רישום למחנה - משפחה ${familyID}`,
            'fullName': payerName || '',
            'phone': phone || '',
            'email': email || '',
            'cfield1': familyID, // המזהה שיחזור אלייך באישור התשלום
            // לאן המשתמש יחזור אחרי ההצלחה/ביטול
            'success_url': "https://meningococcic-myrna-noncancerous.ngrok-free.dev/success",
            'cancel_url': "https://meningococcic-myrna-noncancerous.ngrok-free.dev/cancel"
        });

        const finalUrl = `${baseUrl}?${queryParams.toString()}`;
        
        console.log("קישור סופי ומוכן:");
        console.log(finalUrl);

        // שולחים את הקישור חזרה לאתר שלך
        res.json({ url: finalUrl });

    } catch (err) {
        console.error("שגיאה בלוגיקה:", err.message);
        res.status(500).json({ error: "תקלה פנימית ביצירת הקישור" });
    }
});

app.post('/api/payment-notification', async (req, res) => {
    console.log("Grow Webhook received data:", req.body);

    // חילוץ נתונים בצורה בטוחה (בודק גם אותיות קטנות וגם גדולות)
    const status = req.body.status || req.body.Status;
    const sum = req.body.sum || req.body.Sum;
    const familyID = req.body.cfield1 || req.body.cField1; 
    
    // ב-Grow הצלחה היא הסטטוס 'success' או המספר 1
    if ((status === 'success' || status === '1' || status === 1) && familyID) {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('fId', sql.NVarChar, familyID)
                .input('amt', sql.Decimal(10, 2), sum) 
                .query(`
                    UPDATE R SET 
                        R.ActualAmount = R.ActualAmount + @amt, 
                        R.Status = 'Paid'
                    FROM Registrations R
                    JOIN Children C ON R.ChildID = C.ChildID
                    WHERE C.FamilyID = @fId
                `);
                
            console.log(`Successfully updated DB for family ${familyID} with amount ${sum}`);
            res.status(200).send("OK");
        } catch (err) {
            console.error("Database Update Error:", err);
            res.status(500).send("Internal Server Error");
        }
    } else {
        console.log("Payment not successful or missing familyID. Status:", status);
        res.status(200).send("Notification received"); 
    }
});

app.listen(5000, () => console.log("Server is running perfectly on port 5000"));