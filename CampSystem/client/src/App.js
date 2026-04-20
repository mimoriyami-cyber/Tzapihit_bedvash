import React, { useState, useEffect } from 'react';
import CommitteeRegistration from './CommitteeRegistration';
import axios from 'axios';
import './App.css';

function App() {
  // בדיקה האם המשתמש נמצא בכתובת של הוועדים
  const isCommitteePage = window.location.search.includes('type=committee');

  const [step, setStep] = useState(0);
  const [childID, setChildID] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [touched, setTouched] = useState({}); 
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null); 
  const [familyGroupId, setFamilyGroupId] = useState(''); 

  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtAmount, setDebtAmount] = useState(0);
  
  const [siblingCount, setSiblingCount] = useState(1); 
  const [paymentSettledMsg, setPaymentSettledMsg] = useState(''); 

  const [formData, setFormData] = useState({
    id: '', 
    birthDate: '', 
    firstName: '', 
    lastName: '', 
    gender: '', 
    city: '', 
    streetAddress: '',
    email: '', 
    healthFund: '', 
    otherHealthFund: '', 
    school: '', 
    otherSchool: '', 
    finishedGrade: '', 
    allergies: '', 
    allergiesDetail: '', 
    returnHome: '', 
    healthDeclaration: '', 
    healthDetail: '', 
    attractions: '', 
    swim: '', 
    p1_Name: '', 
    p1_Phone: '', 
    p2_Name: '', 
    p2_Phone: '', 
    extraPhone: '', 
    studentPhone: '',
    payerID: '', 
    payerFirstName: '', 
    payerLastName: '', 
    payerID2: '', 
    payerFirstName2: '', 
    payerLastName2: '',
    notes: '', 
    campCycle: '', 
    terms: false,
    isLocked: false, 
    familyID: '' 
  });

  // אם אנחנו בדף הוועדים, נציג רק את הקומפוננטה שלהם
  if (isCommitteePage) {
    return <CommitteeRegistration />;
  }

  const handlePaymentRedirect = async () => {
    if (!summary || summary.BalanceDue <= 0) {
      setGlobalError("אין יתרה לתשלום");
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/create-payment', {
        familyID: familyGroupId || formData.familyID || formData.id,
        amountToPay: summary.BalanceDue, 
        payerName: `${formData.payerFirstName} ${formData.payerLastName}`, 
        payerID: formData.payerID 
      });

      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      console.error("Payment error:", err);
      setGlobalError("שגיאה ביצירת קשר עם חברת הסליקה. נסה שוב מאוחר יותר.");
    } finally {
      setLoading(false);
    }
  };

  const validateIsraeliID = (id) => {
    if (!id || id.length !== 9 || isNaN(id)) return false;
    let sum = 0, digit;
    for (let i = 0; i < 9; i++) {
      digit = Number(id[i]);
      let stepValue = digit * ((i % 2) + 1);
      sum += stepValue > 9 ? stepValue - 9 : stepValue;
    }
    return sum % 10 === 0;
  };

  const validateEmail = (email) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isFieldInvalid = (field) => {
    if (!touched[field]) return false;
    const val = formData[field];
    
    if (field === 'email' && val) return !validateEmail(val);
    if (field === 'id' || field === 'payerID') return !validateIsraeliID(val);
    
    if (field === 'otherHealthFund' && formData.healthFund === 'אחר') return !val?.trim();
    if (field === 'otherSchool' && formData.school === 'אחר') return !val?.trim();
    
    if (field === 'allergiesDetail' && formData.allergies === 'כן') return !val?.trim();
    if (field === 'healthDetail' && formData.healthDeclaration === 'יש מגבלות') return !val?.trim();
    
    const required = [
      'firstName', 'lastName', 'city', 'streetAddress', 'healthFund', 
      'school', 'finishedGrade', 'p1_Name', 'p1_Phone', 'payerID', 
      'payerFirstName', 'payerLastName', 'campCycle', 'gender', 
      'allergies', 'healthDeclaration', 'attractions', 'swim', 
      'returnHome', 'extraPhone', 'birthDate'
    ];
    
    if (required.includes(field)) {
      return !val || val.toString().trim() === '';
    }
    return false;
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const checkIdentity = async () => {
    if (!validateIsraeliID(childID)) {
      setGlobalError("תעודת זהות אינה תקינה");
      setTouched(prev => ({ ...prev, id: true }));
      return;
    }
    setGlobalError('');
    setPaymentSettledMsg('');
    try {
      const res = await axios.get(`http://localhost:5000/api/check-child/${childID}`);
      if (res.data.exists) {
        setIsExistingUser(true);
      } else {
        setIsExistingUser(false);
        setFormData(prev => ({ ...prev, id: childID }));
        setStep(2); 
      }
    } catch (err) { 
      setGlobalError("שגיאה בחיבור לשרת"); 
    }
  };

  const verifyUser = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/verify-child', { 
        id: childID, 
        birthDate: formData.birthDate 
      });
      
      if (res.data.success) {
        const db = res.data.details;

        if (familyGroupId && db.FamilyID && db.FamilyID !== familyGroupId) {
            setGlobalError("אח/ות זה רשום במערכת תחת משפחה אחרת. אנא פנה למשרד.");
            return;
        }

        if (!familyGroupId) {
            setFamilyGroupId(db.FamilyID || childID);
        }

        setFormData({
          ...formData,
          id: childID,
          familyID: familyGroupId || db.FamilyID || childID,
          birthDate: db.BirthDate ? new Date(db.BirthDate).toISOString().split('T')[0] : '',
          firstName: db.FirstName || '',
          lastName: db.LastName || '',
          gender: db.Gender || '',
          city: db.City || '',
          streetAddress: db.StreetAddress || '',
          email: db.Email || '',
          campCycle: formData.campCycle || db.CampCycle || '',
          healthFund: ['מכבי','כללית','לאומית','מאוחדת'].includes(db.HealthFund) ? db.HealthFund : (db.HealthFund ? 'אחר' : ''),
          otherHealthFund: !['מכבי','כללית','לאומית','מאוחדת'].includes(db.HealthFund) ? db.HealthFund : '',
          school: ['בן גוריון','אשלים','הדרים','רעות','כרמים','באר יעקב - צאלון / סביון','באר יעקב - אמירים / צמרות','באר יעקב - יצחק נבון'].includes(db.School) ? db.School : (db.School ? 'אחר' : ''),
          otherSchool: !['בן גוריון','אשלים','הדרים','רעות','כרמים','באר יעקב - צאלון / סביון','באר יעקב - אמירים / צמרות','באר יעקב - יצחק נבון'].includes(db.School) ? db.School : '',
          finishedGrade: db.FinishedGrade || '',
          p1_Name: db.P1_Name || '',
          p1_Phone: db.P1_Phone || '',
          p2_Name: db.P2_Name || '',
          p2_Phone: db.P2_Phone || '',
          extraPhone: db.EmergencyPhone || '',
          studentPhone: db.StudentPhone || '',
          allergies: db.Allergies === 'לא' ? 'לא' : (db.Allergies ? 'כן' : ''),
          allergiesDetail: db.Allergies !== 'לא' ? db.Allergies : '',
          returnHome: db.ReturnHome || '',
          healthDeclaration: db.HealthDeclaration === 'בריא/ה' ? 'בריא/ה' : 'יש מגבלות',
          healthDetail: db.HealthDeclaration !== 'בריא/ה' ? db.HealthDeclaration : '',
          swim: db.SwimKnowledge || '',
          attractions: db.AttractionsApproval || '',
          notes: db.Notes || '',
          
          payerID: db.PayerID || '',
          payerFirstName: db.payerFirstName || '',
          payerLastName: db.payerLastName || '',
          payerID2: db.PayerID2 || '',
          payerFirstName2: db.payerFirstName2 || '',
          payerLastName2: db.payerLastName2 || '',
          
          isLocked: !!familyGroupId 
        });
        
        setIsVerified(true);

        if (res.data.isPaid) {
          setPaymentSettledMsg("הילד/ה רשום במערכת והתשלום הוסדר, לביטול נא לפנות להנהלה.");
        } else if (res.data.showDebtAlert) {
            setDebtAmount(res.data.balanceAmount);
            setShowDebtModal(true);
        } else {
            alert("הזיהוי הצליח, הפרטים נטענו מהמערכת");
        }
      }
    } catch (err) { 
        setGlobalError("אימות נכשל: תאריך לידה אינו תואם או שגיאת שרת"); 
    }
  };

  const canGoNext = (fields) => {
    const newTouched = {};
    fields.forEach(f => newTouched[f] = true);
    setTouched(prev => ({ ...prev, ...newTouched }));

    const hasErrors = fields.some(f => {
        const val = formData[f];
        const optionalIf = [
          'p2_Name', 'p2_Phone', 'studentPhone', 'notes', 'otherHealthFund', 
          'otherSchool', 'allergiesDetail', 'healthDetail', 'payerID2', 
          'payerFirstName2', 'payerLastName2', 'email'
        ];
        
        const isInvalidFormat = isFieldInvalid(f); 
        const isMissing = !optionalIf.includes(f) && (!val || val.toString().trim() === '');
        
        return isInvalidFormat || isMissing;
    });

    if (hasErrors) {
      setGlobalError("יש למלא את כל שדות החובה המסומנים באדום");
      return false;
    }
    setGlobalError('');
    return true;
  };

  const saveToSQL = async () => {
    if (loading) return;
    if (!formData.terms) {
      setGlobalError("יש לאשר את תקנון הקייטנה");
      return;
    }
    if (!canGoNext(['payerID', 'payerFirstName', 'payerLastName'])) return;

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/register', {
          ...formData,
          familyID: familyGroupId || formData.id 
      });
      setSummary(response.data.summary); 
      setStep(6);
    } catch (err) { 
      setGlobalError("שגיאה בשמירה: " + (err.response?.data?.error || err.message)); 
    } finally {
      setLoading(false);
    }
  };

  const handleAddSibling = () => {
    if (!familyGroupId) {
        setFamilyGroupId(formData.id);
    }

    const sharedData = {
        lastName: formData.lastName,
        city: formData.city,
        streetAddress: formData.streetAddress,
        p1_Name: formData.p1_Name,
        p1_Phone: formData.p1_Phone,
        p2_Name: formData.p2_Name,
        p2_Phone: formData.p2_Phone,
        extraPhone: formData.extraPhone,
        payerID: formData.payerID,
        payerFirstName: formData.payerFirstName,
        payerLastName: formData.payerLastName,
        payerID2: formData.payerID2,
        payerFirstName2: formData.payerFirstName2,
        payerLastName2: formData.payerLastName2,
        campCycle: formData.campCycle
    };

    setSiblingCount(prev => prev + 1); 
    setChildID('');
    setIsExistingUser(null);
    setIsVerified(false);
    setTouched({});
    setPaymentSettledMsg('');
    
    setFormData({
      ...formData,
      id: '', 
      birthDate: '', 
      firstName: '', 
      gender: '',
      finishedGrade: '', 
      allergies: '', 
      allergiesDetail: '', 
      healthDeclaration: '', 
      healthDetail: '',
      attractions: '', 
      swim: '', 
      returnHome: '', 
      notes: '', 
      terms: false,
      studentPhone: '', 
      email: '', 
      ...sharedData,
      isLocked: true, 
      familyID: familyGroupId || formData.id
    });
    setStep(1); 
  };

  const cancelSiblingAddition = () => {
    if (window.confirm("האם לבטל את הוספת האח ולחזור לסיכום הרישום?")) {
        setSiblingCount(prev => prev - 1);
        setStep(6); 
    }
  };

  const getProgress = () => (step / 6) * 100;

  return (
    <div className="form-container" dir="rtl">
      
        <>
          {/* Header סטטוס אחים */}
          {step > 0 && step < 6 && (
            <div className="sibling-status-header">
              <span>רישום ילד {siblingCount} מתוך 3</span>
              {siblingCount > 1 && step === 1 && (
                <button className="cancel-link" onClick={cancelSiblingAddition}>(ביטול הוספה וחזרה)</button>
              )}
            </div>
          )}

          {/* פס התקדמות */}
          {step > 0 && (
            <div className="progress-container" style={{width: '100%', backgroundColor: '#eee', borderRadius: '10px', height: '10px', marginBottom: '20px', overflow: 'hidden'}}>
              <div style={{
                width: `${getProgress()}%`,
                backgroundColor: 'var(--primary)', 
                height: '100%',
                transition: 'width 0.3s ease-in-out'
              }}></div>
            </div>
          )}

          {/* הודעות מערכת */}
          {globalError && <div className="error-banner">{globalError}</div>}
          {paymentSettledMsg && <div className="success-banner">{paymentSettledMsg}</div>}

          {/* מודאל חוב קיים */}
          {showDebtModal && (
            <div className="modal-overlay" style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'var(--overlay)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
              <div className="form-container" style={{maxWidth:'30rem', background: '#fff', padding: '2rem', borderRadius: '15px'}}>
                <h3>הילד/ה רשום במערכת אך קיים חוב</h3>
                <p>נותרה יתרה לתשלום על סך: ₪{debtAmount}</p>
                <div className="btn-row">
                  <button className="main-btn" onClick={() => { setShowDebtModal(false); setStep(2); }}>עריכת פרטים</button>
                  <button className="success-btn" onClick={() => { setShowDebtModal(false); setStep(6); }}>מעבר לתשלום להסדר החוב</button>
                </div>
              </div>
            </div>
          )}

          {/* שלב 0: דף נחיתה */}
          {step === 0 && (
            <div className="step-box fade-in">
              <div className="flyer-container">
                <img src="/flyer.jpg" alt="פלייר קייטנה 2026" className="flyer-image" />
              </div>
              <button className="main-btn ripple" onClick={() => setStep(1)}>לרישום לחץ כאן</button>
            </div>
          )}

          {/* שלב 1: הזדהות ואימות */}
          {step === 1 && (
            <div className="step-box fade-in">
              <h3>שלב 1: הזדהות</h3>
              <div className="grid-form">
                <label>ת.ז. הילד/ה:</label>
                <input 
                  type="text"
                  maxLength="9"
                  placeholder="הזן תעודת זהות" 
                  value={childID} 
                  onChange={(e) => setChildID(e.target.value)} 
                  onBlur={() => handleBlur('id')}
                  className={isFieldInvalid('id') ? "input-error" : ""}
                />
              </div>
              {!isExistingUser && <button className="main-btn" onClick={checkIdentity}>המשך</button>}
              
              {isExistingUser && (
                <div className="auth-section" style={{marginTop:'1.5rem', borderTop:'1px solid #eee', paddingTop:'1.5rem'}}>
                  <p>הילד/ה רשום/ה במערכת. יש להזין תאריך לידה לאימות:</p>
                  <div className="grid-form">
                    <label>תאריך לידה:</label>
                    <input type="date" value={formData.birthDate} onChange={(e) => updateField('birthDate', e.target.value)} />
                  </div>
                  {!isVerified ? (
                    <button className="main-btn" onClick={verifyUser}>אמת תאריך</button>
                  ) : (
                    <button className="success-btn" onClick={() => setStep(2)}>זוהה בהצלחה! לעדכון פרטים לחץ כאן</button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* שלב 2: פרטים אישיים */}
          {step === 2 && (
            <div className="step-box fade-in">
              <h3>דף 2: פרטים אישיים</h3>
              <div className="grid-form">
                <label>* מחזור:</label>
                <select value={formData.campCycle} onChange={(e) => updateField('campCycle', e.target.value)} onBlur={() => handleBlur('campCycle')} className={isFieldInvalid('campCycle') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר מחזור קייטנה...</option>
                  <option value="1">מחזור א' (01/07-21/07)</option>
                  <option value="2">מחזור ב' (22/07-10/08)</option>
                  <option value="3">מחזור א + ב' (01/07-10/08)</option>
                </select>

                <label>תעודת זהות:</label>
                <div className="readonly-value">{childID}</div>

                <label>* תאריך לידה:</label>
                {isVerified ? (
                  <div className="readonly-value">{formData.birthDate}</div>
                ) : (
                  <input type="date" value={formData.birthDate} onChange={(e) => updateField('birthDate', e.target.value)} onBlur={() => handleBlur('birthDate')} className={isFieldInvalid('birthDate') ? "input-error" : ""} />
                )}

                <label>* שם פרטי:</label>
                <input placeholder="שם פרטי" value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} onBlur={() => handleBlur('firstName')} className={isFieldInvalid('firstName') ? "input-error" : ""} />
                
                <label>* שם משפחה:</label>
                <input placeholder="שם משפחה" value={formData.lastName} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('lastName') ? "input-error" : "")} onChange={(e) => updateField('lastName', e.target.value)} onBlur={() => handleBlur('lastName')} />
                
                <label>* מין:</label>
                <select value={formData.gender} onChange={(e) => updateField('gender', e.target.value)} onBlur={() => handleBlur('gender')} className={isFieldInvalid('gender') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר...</option>
                  <option value="בן">בן</option>
                  <option value="בת">בת</option>
                </select>

                <label>* עיר:</label>
                <input placeholder="עיר" value={formData.city} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('city') ? "input-error" : "")} onChange={(e) => updateField('city', e.target.value)} onBlur={() => handleBlur('city')} />
                
                <label>* כתובת:</label>
                <input placeholder="רחוב ומספר" value={formData.streetAddress} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('streetAddress') ? "input-error" : "")} onChange={(e) => updateField('streetAddress', e.target.value)} onBlur={() => handleBlur('streetAddress')} />
                
                <label>מייל:</label>
                <input placeholder="email@example.com" value={formData.email} onChange={(e) => updateField('email', e.target.value)} onBlur={() => handleBlur('email')} className={isFieldInvalid('email') ? "input-error" : ""} />

                <label>* קופת חולים:</label>
                <select value={formData.healthFund} onChange={(e) => updateField('healthFund', e.target.value)} onBlur={() => handleBlur('healthFund')} className={isFieldInvalid('healthFund') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר קופה...</option>
                  {['מכבי','כללית','לאומית','מאוחדת','אחר'].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {formData.healthFund === 'אחר' && (
                  <><label>* פרט קופה:</label><input placeholder="שם הקופה" value={formData.otherHealthFund} onChange={(e) => updateField('otherHealthFund', e.target.value)} onBlur={() => handleBlur('otherHealthFund')} className={isFieldInvalid('otherHealthFund') ? "input-error" : ""} /></>
                )}

                <label>* בית ספר:</label>
                <select value={formData.school} onChange={(e) => updateField('school', e.target.value)} onBlur={() => handleBlur('school')} className={isFieldInvalid('school') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר בית ספר...</option>
                  {['בן גוריון','אשלים','הדרים','רעות','כרמים','באר יעקב - צאלון / סביון','באר יעקב - אמירים / צמרות','באר יעקב - יצחק נבון','אחר'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {formData.school === 'אחר' && (
                  <><label>* פרט בי"ס:</label><input placeholder="שם בית הספר" value={formData.otherSchool} onChange={(e) => updateField('otherSchool', e.target.value)} onBlur={() => handleBlur('otherSchool')} className={isFieldInvalid('otherSchool') ? "input-error" : ""} /></>
                )}

                <label>* כיתה:</label>
                <select value={formData.finishedGrade} onChange={(e) => updateField('finishedGrade', e.target.value)} onBlur={() => handleBlur('finishedGrade')} className={isFieldInvalid('finishedGrade') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר כיתה שסיים...</option>
                  {['א','ב','ג','ד','ה','ו'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(1)}>חזור</button>
                <button className="next-btn" onClick={() => canGoNext(['campCycle','firstName','lastName','gender','city','streetAddress','healthFund','otherHealthFund','school','otherSchool','finishedGrade', 'birthDate']) && setStep(3)}>המשך</button>
              </div>
            </div>
          )}

          {/* שלב 3: בריאות ואישורים */}
          {step === 3 && (
            <div className="step-box fade-in">
              <h3>דף 3: בריאות ואישורים</h3>
              <div className="health-notice">* במקרים מיוחדים יש לפנות להנהלת הקייטנה לאישור הרישום והצגת אישור רפואי</div>
              <div className="grid-form">
                <label>* אלרגיות?</label>
                <select value={formData.allergies} onChange={(e) => updateField('allergies', e.target.value)} onBlur={() => handleBlur('allergies')} className={isFieldInvalid('allergies') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר/י...</option>
                  <option value="לא">לא</option>
                  <option value="כן">כן</option>
                </select>
                {formData.allergies === 'כן' && (
                  <>
                    <label>פירוט אלרגיה:</label>
                    <div>
                      <textarea placeholder="פרט כאן..." value={formData.allergiesDetail} onChange={(e) => updateField('allergiesDetail', e.target.value)} onBlur={() => handleBlur('allergiesDetail')} className={isFieldInvalid('allergiesDetail') ? "input-error" : ""} maxLength="200" />
                      <div className="char-counter">{(formData.allergiesDetail || "").length}/200</div>
                    </div>
                  </>
                )}

                <label>* הצהרת בריאות:</label>
                <select value={formData.healthDeclaration} onChange={(e) => updateField('healthDeclaration', e.target.value)} onBlur={() => handleBlur('healthDeclaration')} className={isFieldInvalid('healthDeclaration') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר/י...</option>
                  <option value="בריא/ה">בני/בתי בריא/ה</option>
                  <option value="יש מגבלות">יש מגבלות רפואיות</option>
                </select>
                {formData.healthDeclaration === 'יש מגבלות' && (
                  <>
                    <label>פירוט מגבלה:</label>
                    <div>
                      <textarea placeholder="פרט כאן..." value={formData.healthDetail} onChange={(e) => updateField('healthDetail', e.target.value)} onBlur={() => handleBlur('healthDetail')} className={isFieldInvalid('healthDetail') ? "input-error" : ""} maxLength="200" />
                      <div className="char-counter">{(formData.healthDetail || "").length}/200</div>
                    </div>
                  </>
                )}

                <label>* אטרקציות:</label>
                <select value={formData.attractions} onChange={(e) => updateField('attractions', e.target.value)} onBlur={() => handleBlur('attractions')} className={isFieldInvalid('attractions') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר/י...</option>
                  <option value="מאשר">מאשר יציאה לאטרקציות</option>
                  <option value="לא מאשר">לא מאשר</option>
                </select>

                <label>* ידע בשחייה:</label>
                <select value={formData.swim} onChange={(e) => updateField('swim', e.target.value)} onBlur={() => handleBlur('swim')} className={isFieldInvalid('swim') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר/י...</option>
                  <option value="כן">יודע/ת לשחות</option>
                  <option value="לא">לא יודע/ת לשחות</option>
                </select>

                <label>* אופן חזרה:</label>
                <select value={formData.returnHome} onChange={(e) => updateField('returnHome', e.target.value)} onBlur={() => handleBlur('returnHome')} className={isFieldInvalid('returnHome') ? "input-error" : ""}>
                  <option value="" disabled hidden>בחר/י...</option>
                  <option value="חוזר לבד">חוזר לבד</option>
                  <option value="חוזר עם מלווה">חוזר עם מלווה</option>
                </select>
              </div>
              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(2)}>חזור</button>
                <button className="next-btn" onClick={() => canGoNext(['allergies', 'allergiesDetail', 'healthDeclaration', 'healthDetail', 'attractions', 'swim', 'returnHome']) && setStep(4)}>המשך</button>
              </div>
            </div>
          )}

          {/* שלב 4: קשר והערות */}
          {step === 4 && (
            <div className="step-box fade-in">
              <h3>דף 4: פרטי קשר והערות</h3>
              <div className="grid-form">
                <label>* שם הורה 1:</label>
                <input placeholder="שם מלא" value={formData.p1_Name} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('p1_Name') ? "input-error" : "")} onChange={(e) => updateField('p1_Name', e.target.value)} onBlur={() => handleBlur('p1_Name')} />
                
                <label>* טלפון הורה 1:</label>
                <input placeholder="05XXXXXXXX" value={formData.p1_Phone} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('p1_Phone') ? "input-error" : "")} onChange={(e) => updateField('p1_Phone', e.target.value)} onBlur={() => handleBlur('p1_Phone')} />
                
                <label>שם הורה 2:</label>
                <input placeholder="שם מלא" value={formData.p2_Name} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : ""} onChange={(e) => updateField('p2_Name', e.target.value)} />
                
                <label>טלפון הורה 2:</label>
                <input placeholder="טלפון" value={formData.p2_Phone} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : ""} onChange={(e) => updateField('p2_Phone', e.target.value)} />
                
                <label>* טלפון חירום:</label>
                <input placeholder="טלפון נוסף" value={formData.extraPhone} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('extraPhone') ? "input-error" : "")} onChange={(e) => updateField('extraPhone', e.target.value)} onBlur={() => handleBlur('extraPhone')} />
                
                <label>נייד תלמיד:</label>
                <input placeholder="נייד (אופציונלי)" value={formData.studentPhone} onChange={(e) => updateField('studentPhone', e.target.value)} />

                <label>הערות מיוחדות:</label>
                <div>
                  <textarea placeholder="הערות למשרד..." value={formData.notes} onChange={(e) => updateField('notes', e.target.value)} maxLength="200" />
                  <div className="char-counter">{(formData.notes || "").length}/200</div>
                </div>
              </div>
              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(3)}>חזור</button>
                <button className="sibling-btn" onClick={() => canGoNext(['p1_Name', 'p1_Phone', 'extraPhone']) && handleAddSibling()}>+ הוסף אח/ות</button>
                <button className="next-btn" onClick={() => canGoNext(['p1_Name', 'p1_Phone', 'extraPhone']) && setStep(5)}>המשך</button>
              </div>
            </div>
          )}

          {/* שלב 5: משלם ותקנון */}
          {step === 5 && (
            <div className="step-box fade-in">
              <h3>דף 5: פרטי משלם ותקנון</h3>
              <div className="grid-form">
                <h4 style={{gridColumn:'1 / -1', margin:'1rem 0', color:'var(--primary-dark)'}}>משלם 1 (חובה)</h4>
                <label>* ת.ז. משלם:</label>
                <input placeholder="ת.ז." value={formData.payerID} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('payerID') ? "input-error" : "")} onChange={(e) => updateField('payerID', e.target.value)} onBlur={() => handleBlur('payerID')} />
                <label>* שם פרטי:</label>
                <input placeholder="שם" value={formData.payerFirstName} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('payerFirstName') ? "input-error" : "")} onChange={(e) => updateField('payerFirstName', e.target.value)} onBlur={() => handleBlur('payerFirstName')} />
                <label>* שם משפחה:</label>
                <input placeholder="משפחה" value={formData.payerLastName} readOnly={formData.isLocked} className={formData.isLocked ? "input-locked" : (isFieldInvalid('payerLastName') ? "input-error" : "")} onChange={(e) => updateField('payerLastName', e.target.value)} onBlur={() => handleBlur('payerLastName')} />
                
                <hr style={{gridColumn:'1 / -1', width:'100%', border:'0', borderTop:'1px solid #eee', margin:'1.5rem 0'}}/>
                
                <h4 style={{gridColumn:'1 / -1', margin:'0 0 1rem', color:'var(--primary-dark)'}}>משלם 2 (אופציונלי)</h4>
                <label>ת.ז. משלם 2:</label>
                <input placeholder="ת.ז." value={formData.payerID2} readOnly={formData.isLocked} onChange={(e) => updateField('payerID2', e.target.value)} />
                <label>שם פרטי 2:</label>
                <input placeholder="שם" value={formData.payerFirstName2} readOnly={formData.isLocked} onChange={(e) => updateField('payerFirstName2', e.target.value)} />
                <label>שם משפחה 2:</label>
                <input placeholder="משפחה" value={formData.payerLastName2} readOnly={formData.isLocked} onChange={(e) => updateField('payerLastName2', e.target.value)} />
              </div>

              <div className="terms-section" style={{margin:'2rem 0', padding: '1rem', background: '#f9f9f9', borderRadius: '8px'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <input type="checkbox" checked={formData.terms} onChange={(e) => updateField('terms', e.target.checked)} style={{width:'20px', height: '20px'}} />
                  <span>קראתי ואני מאשר את <a href="/terms.pdf" target="_blank">תקנון הקייטנה</a></span>
                </div>
              </div>

              <div className="btn-row">
                <button className="back-btn" onClick={() => setStep(4)}>חזור</button>
                <button className="success-btn" onClick={saveToSQL} disabled={loading}>{loading ? "שומר..." : "סיום וסיכום"}</button>
              </div>
            </div>
          )}

          {/* שלב 6: סיכום וסליקה */}
          {step === 6 && summary && (
            <div className="step-box fade-in">
              <h3>שלב 6: סיכום תשלום</h3>
              <div className="summary-card" style={{background: '#f4f7f6', padding: '1.5rem', borderRadius: '12px', margin: '1rem 0'}}>
                <div className="summary-line">
                  <span>מספר ילדים רשומים:</span>
                  <strong>{summary.NumberOfChildren}</strong>
                </div>
                <div className="summary-line">
                  <span>עלות כוללת:</span>
                  <strong>₪{summary.TotalExpected}</strong>
                </div>
                <div className="summary-line">
                  <span>סכום ששולם:</span>
                  <strong>₪{summary.TotalPaid}</strong>
                </div>
                <div className="summary-line total-line" style={{borderTop: '2px solid #ddd', paddingTop: '1rem', marginTop: '1rem', fontSize: '1.2rem', color: '#d32f2f'}}>
                  <span>יתרה לתשלום:</span>
                  <strong>₪{summary.BalanceDue}</strong>
                </div>
              </div>
              <div className="btn-row">
                <button className="pay-btn ripple" onClick={handlePaymentRedirect} disabled={loading}>
                  {loading ? "מנתב לסליקה..." : "עבור לתשלום מאובטח"}
                </button>
              </div>
            </div>
          )}
        </>
    </div>
  );
}

export default App;