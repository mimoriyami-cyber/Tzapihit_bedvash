import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

  const schoolsByCity = {
  "ראשון לציון": ["בן גוריון", "הדרים", "רעות", "תמיר", "אשלים", "מיתרים", "סלמון"],
  "נס ציונה": ["אשכול", "לב המושבה", "סביונים", "אירוס", "שקד", "ארגמן", "הדר", "בן צבי", "ראשונים", "ניצנים", "שיבולים"],
  "באר יעקב": ["צאלון", "בראשית", "אילן רמון", "יצחק נבון", "אמירים", "צמרות", "ביאליק", "אילנות", "תלמים"]
};

function CommitteeRegistration() {
  const [step, setStep] = useState(0);
  const [childId, setChildId] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [touched, setTouched] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);


const [agreedToRules, setAgreedToRules] = useState(false);

  const [formData, setFormData] = useState({
    campCycle: '',
    id: '',
    birthDate: '',
    firstName: '',
    lastName: '',
    gender: '',
    city: '',
    otherCity:'',
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
    p1Name: '',
    p1Phone: '',
    p2Name: '',
    p2Phone: '',
    extraPhone: '',
    studentPhone: '',
    notes: '',
    registrationStatus: 'ממתין'
  });

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
    if (field === 'id') return !validateIsraeliID(val);

    if (field === 'otherCity' && formData.city === 'אחר') return !val?.trim();
    if (field === 'otherHealthFund' && formData.healthFund === 'אחר') return !val?.trim();
    if (field === 'otherSchool' && formData.school === 'אחר') return !val?.trim();

    if (field === 'allergiesDetail' && formData.allergies === 'כן') return !val?.trim();
    if (field === 'healthDetail' && formData.healthDeclaration === 'יש מגבלות') return !val?.trim();

    const required = [
      'firstName', 'lastName', 'city', 'streetAddress', 'healthFund',
      'school', 'finishedGrade', 'p1Name', 'p1Phone', 'gender',
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
    if (!validateIsraeliID(childId)) {
      setGlobalError("תעודת זהות אינה תקינה");
      setTouched(prev => ({ ...prev, id: true }));
      return;
    }
    setGlobalError('');
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('childidnumber', childId) // עודכן לאותיות קטנות
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsExistingUser(true);
      } else {
        setIsExistingUser(false);
        setFormData(prev => ({ ...prev, id: childId }));
        setStep(2);
      }
    } catch (err) {
      setGlobalError("שגיאה בחיבור למסד הנתונים");
    } finally {
      setLoading(false);
    }
  };

const verifyUser = async () => {
    setLoading(true);
    setGlobalError('');
    try {
      const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('childidnumber', childId)
        .eq('birthdate', formData.birthDate)
        .maybeSingle();

      if (error || !data) {
        setGlobalError("אימות נכשל: תאריך לידה אינו תואם או שהילד אינו רשום");
      } else {
        // טעינת הנתונים מהשדות ב-DB לתוך ה-State
        setFormData({
          ...formData,
          id: data.childidnumber || '',
          birthDate: data.birthdate || '',
          campCycle: data.campcycle || '',
          firstName: data.firstname || '',
          lastName: data.lastname || '',
          gender: data.gender || '',
          city: data.city || '',
          streetAddress: data.streetaddress || '',
          email: data.email || '',
          healthFund: data.healthfund || '',
          school: data.school || '',
          finishedGrade: data.finishedgrade || '',
          p1Name: data.p1_name || '',
          p1Phone: data.p1_phone || '',
          p2Name: data.p2_name || '',
          p2Phone: data.p2_phone || '',
          extraPhone: data.emergencyphone || '',
          studentPhone: data.studentphone || '',
          notes: data.notes || '',
        });

        // עדכון סטטוס אימות ללא הודעה קופצת
        setIsVerified(true);
        setGlobalError(''); // ניקוי שגיאות אם היו
        
        // מעבר אוטומטי לשלב הבא לאחר חצי שנייה כדי שהמשתמש יספיק לראות שהכפתור הפך לירוק
        setTimeout(() => {
          setStep(2);
        }, 600);
      }
    } catch (err) {
      setGlobalError("שגיאה בתהליך האימות");
    } finally {
      setLoading(false);
    }
  };

  const canGoNext = (fields) => {
    const newTouched = {};
    fields.forEach(f => newTouched[f] = true);
    setTouched(prev => ({ ...prev, ...newTouched }));

    const hasErrors = fields.some(f => {
      const val = formData[f];
      const optionalIf = [
        'p2Name', 'p2Phone', 'studentPhone', 'notes', 'otherHealthFund',
        'otherSchool', 'allergiesDetail', 'healthDetail', 'email'
      ];

      return isFieldInvalid(f) || (!optionalIf.includes(f) && (!val || val.toString().trim() === ''));
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
    setLoading(true);
    try {
      const dataToSave = {
        childidnumber: formData.id,
        birthdate: formData.birthDate,
        campcycle: formData.campCycle,
        
        // --- שורות עם שינוי איחוד (אחר) ---
        city: formData.city === 'אחר' ? formData.otherCity : formData.city, // שינוי: מאחד עיר חופשית לתוך עמודת city
        school: formData.school === 'אחר' ? formData.otherSchool : formData.school, // שינוי: מאחד בית ספר חופשי לתוך עמודת school
        healthfund: formData.healthFund === 'אחר' ? formData.otherHealthFund : formData.healthFund, // שינוי: מאחד קופת חולים חופשית לתוך עמודת healthfund
        
        firstname: formData.firstName,
        lastname: formData.lastName,
        gender: formData.gender,
        streetaddress: formData.streetAddress,
        email: formData.email,
        finishedgrade: formData.finishedGrade,
        
        // לוגיקה קיימת לאלרגיות והצהרת בריאות
        allergies: formData.allergies === 'כן' ? formData.allergiesDetail : 'לא',
        healthdeclaration: formData.healthDeclaration === 'יש מגבלות' ? formData.healthDetail : 'בריא/ה',
        
        attractionsapproval: formData.attractions === 'כן' ? 'כן' : 'לא',
        swimknowledge: formData.swim === 'כן' ? 'כן' : 'לא',
        returnhome: formData.returnHome,
        p1_name: formData.p1Name,
        p1_phone: formData.p1Phone,
        p2_name: formData.p2Name,
        p2_phone: formData.p2Phone,
        emergencyphone: formData.extraPhone,
        studentphone: formData.studentPhone,
        notes: formData.notes,
        registrationstatus: 'ממתין'
      };

      const { error } = await supabase
        .from('children')
        .upsert([dataToSave], { onConflict: 'childidnumber' });

      if (error) throw error;
      setStep(5);
    } catch (err) {
      setGlobalError("שגיאה בשמירה: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = () => (step / 4) * 100;

  return (
    <div className="form-container" dir="rtl">

      {step > 0 && step < 5 && (
        <div className="sibling-status-header">
          <span>רישום ילד לוועד עובדים</span>
        </div>
      )}

      {step > 0 && step < 5 && (
        <div className="progress-container" style={{ width: '100%', backgroundColor: '#eee', borderRadius: '10px', height: '10px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{
            width: `${getProgress()}%`,
            backgroundColor: 'var(--primary)',
            height: '100%',
            transition: 'width 0.3s ease-in-out'
          }}></div>
        </div>
      )}

      {globalError && <div className="error-banner">{globalError}</div>}


      {step === 0 && (
        <div className="step-box fade-in">
          <div className="flyer-container">
            <img src="/flyer.jpg" alt="פלייר קייטנה" className="flyer-image" />
          </div>
          <button className="main-btn ripple" onClick={() => setStep(1)}>לרישום דרך וועד  לחץ כאן</button>
        </div>
      )}

      {step === 1 && (
        <div className="step-box fade-in">
          <h3>שלב 1: הזדהות</h3>
          <div className="grid-form">
            <label>ת.ז. הילד/ה:</label>
            <input
              type="text"
              maxLength="9"
              placeholder="הזן תעודת זהות"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              onBlur={() => handleBlur('id')}
              className={isFieldInvalid('id') ? "input-error" : ""}
            />
          </div>
          {!isExistingUser && <button className="main-btn" onClick={checkIdentity} disabled={loading}>המשך</button>}

          {isExistingUser && (
            <div className="auth-section" style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <p>הילד/ה רשום/ה במערכת. יש להזין תאריך לידה לאימות:</p>
              <div className="grid-form">
                <label>תאריך לידה:</label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => updateField('birthDate', e.target.value)}
                />
              </div>
              <button className="main-btn" onClick={verifyUser} disabled={loading}>אמת נתונים</button>
            </div>
          )}
        </div>
      )}
{step === 2 && (
  <div className="step-box fade-in">
    <h3>דף 2: פרטים אישיים</h3>
    <div className="grid-form">
      <label>תעודת זהות:</label>
      <div className="readonly-value">{childId}</div>

      <label>* תאריך לידה:</label>
      {isVerified ? (
        <div className="readonly-value">{formData.birthDate}</div>
      ) : (
        <input
          type="date"
          value={formData.birthDate}
          onChange={(e) => updateField('birthDate', e.target.value)}
          onBlur={() => handleBlur('birthDate')}
          className={isFieldInvalid('birthDate') ? "input-error" : ""}
        />
      )}

      <label>* מחזור:</label>
      <select 
        value={formData.campCycle} 
        onChange={(e) => updateField('campCycle', e.target.value)} 
        onBlur={() => handleBlur('campCycle')} 
        className={isFieldInvalid('campCycle') ? "input-error" : ""}
      >
        <option value="" disabled hidden>בחר מחזור...</option>
        <option value="מחזור א">מחזור א'</option>
        <option value="מחזור ב">מחזור ב'</option>
        <option value="מחזור א+ב">מחזור א' + ב'</option>
      </select>

      <label>* שם פרטי:</label>
      <input
        placeholder="שם פרטי"
        value={formData.firstName}
        onChange={(e) => updateField('firstName', e.target.value)}
        onBlur={() => handleBlur('firstName')}
        className={isFieldInvalid('firstName') ? "input-error" : ""}
      />

      <label>* שם משפחה:</label>
      <input
        placeholder="שם משפחה"
        value={formData.lastName}
        onChange={(e) => updateField('lastName', e.target.value)}
        onBlur={() => handleBlur('lastName')}
        className={isFieldInvalid('lastName') ? "input-error" : ""}
      />

      <label>* מין:</label>
      <select
        value={formData.gender}
        onChange={(e) => updateField('gender', e.target.value)}
        onBlur={() => handleBlur('gender')}
        className={isFieldInvalid('gender') ? "input-error" : ""}
      >
        <option value="" disabled hidden>בחר...</option>
        <option value="בן">בן</option>
        <option value="בת">בת</option>
      </select>

      <label>* עיר:</label>
      <div className="field-group-container">
        <select 
          value={formData.city} 
          onChange={(e) => {
            const val = e.target.value;
            updateField('city', val);
            updateField('school', ''); // איפוס בית הספר בשינוי עיר
            if (val !== 'אחר') {
              updateField('otherCity', ''); // ניקוי טקסט
              setTouched(prev => ({ ...prev, otherCity: false })); // ניקוי שגיאה
            }
          }} 
          onBlur={() => handleBlur('city')}
          className={isFieldInvalid('city') ? "input-error" : ""}
        >
          <option value="" disabled hidden>בחר עיר...</option>
          <option value="ראשון לציון">ראשון לציון</option>
          <option value="נס ציונה">נס ציונה</option>
          <option value="באר יעקב">באר יעקב</option>
          <option value="אחר">אחר (נא לפרט)</option>
        </select>
        {formData.city === 'אחר' && (
          <input 
            placeholder="כתבי שם עיר" 
            value={formData.otherCity}
            onChange={(e) => updateField('otherCity', e.target.value)} 
            onBlur={() => handleBlur('otherCity')}
            className={isFieldInvalid('otherCity') ? "input-error mt-2" : "mt-2"}
          />
        )}
      </div>

      <label>* כתובת:</label>
      <input
        placeholder="רחוב ומספר"
        value={formData.streetAddress}
        onChange={(e) => updateField('streetAddress', e.target.value)}
        onBlur={() => handleBlur('streetAddress')}
        className={isFieldInvalid('streetAddress') ? "input-error" : ""}
      />

      <label>מייל:</label>
      <input
        placeholder="email@example.com"
        value={formData.email}
        onChange={(e) => updateField('email', e.target.value)}
        onBlur={() => handleBlur('email')}
        className={isFieldInvalid('email') ? "input-error" : ""}
      />

      <label>* קופת חולים:</label>
      <select
        value={formData.healthFund}
        onChange={(e) => {
          const val = e.target.value;
          updateField('healthFund', val);
          if (val !== 'אחר') {
            updateField('otherHealthFund', ''); // ניקוי טקסט
            setTouched(prev => ({ ...prev, otherHealthFund: false })); // ניקוי שגיאה
          }
        }}
        onBlur={() => handleBlur('healthFund')}
        className={isFieldInvalid('healthFund') ? "input-error" : ""}
      >
        <option value="" disabled hidden>בחר קופה...</option>
        {['מכבי', 'כללית', 'לאומית', 'מאוחדת', 'אחר'].map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      {formData.healthFund === 'אחר' && (
        <>
          <label>* פרט קופה:</label>
          <input
            placeholder="שם הקופה"
            value={formData.otherHealthFund}
            onChange={(e) => updateField('otherHealthFund', e.target.value)}
            onBlur={() => handleBlur('otherHealthFund')}
            className={isFieldInvalid('otherHealthFund') ? "input-error" : ""}
          />
        </>
      )}

      <label>* בית ספר:</label>
      <div className="field-group-container">
        <select
          value={formData.school}
          onChange={(e) => {
            const val = e.target.value;
            updateField('school', val);
            if (val !== 'אחר') {
              updateField('otherSchool', ''); // ניקוי טקסט
              setTouched(prev => ({ ...prev, otherSchool: false })); // ניקוי שגיאה
            }
          }}
          onBlur={() => handleBlur('school')}
          className={isFieldInvalid('school') ? "input-error" : ""}
        >
          <option value="" disabled hidden>בחר בית ספר...</option>
          {schoolsByCity[formData.city]?.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="אחר">אחר...</option>
        </select>
        {formData.school === 'אחר' && (
          <input
            placeholder="שם בית הספר"
            value={formData.otherSchool}
            onChange={(e) => updateField('otherSchool', e.target.value)}
            onBlur={() => handleBlur('otherSchool')}
            className={isFieldInvalid('otherSchool') ? "input-error mt-2" : "mt-2"}
          />
        )}
      </div>

      <label>* כיתה שסיים:</label>
      <select
        value={formData.finishedGrade}
        onChange={(e) => updateField('finishedGrade', e.target.value)}
        onBlur={() => handleBlur('finishedGrade')}
        className={isFieldInvalid('finishedGrade') ? "input-error" : ""}
      >
        <option value="" disabled hidden>בחר כיתה...</option>
        {['א', 'ב', 'ג', 'ד', 'ה', 'ו'].map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    </div>
    <div className="btn-row">
      <button className="back-btn" onClick={() => setStep(1)}>חזור</button>
    <button 
  className="next-btn" 
  onClick={() => {
    // 1. רשימת שדות שתמיד חייבים להיות מלאים בדף 2
    let fieldsToCheck = [
      'campCycle', 'firstName', 'lastName', 'gender', 'city', 
      'streetAddress', 'healthFund', 'school', 'finishedGrade', 'birthDate'
    ];
    
    // 2. הוספת שדות ה"אחר" לרשימת הבדיקה רק אם המשתמש בחר באופציית "אחר"
    if (formData.city === 'אחר') fieldsToCheck.push('otherCity');
    if (formData.healthFund === 'אחר') fieldsToCheck.push('otherHealthFund');
    if (formData.school === 'אחר') fieldsToCheck.push('otherSchool');

    // 3. הרצת הבדיקה רק על השדות הרלוונטיים
    if (canGoNext(fieldsToCheck)) {
      setStep(3);
    }
  }}
>
  המשך
</button>
    </div>
  </div>
)}

      {step === 3 && (
        <div className="step-box fade-in">
          <h3>דף 3: בריאות ואישורים</h3>
          <div className="health-notice" style={{ color: 'red', fontWeight: 'bold', border: '1px solid red', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
            * במקרים מיוחדים יש לפנות להנהלת הקייטנה לאישור הרישום והצגת אישור רפואי
          </div>
          <div className="grid-form">
            <label>* אלרגיות?</label>
            <select
              value={formData.allergies}
              onChange={(e) => updateField('allergies', e.target.value)}
              onBlur={() => handleBlur('allergies')}
              className={isFieldInvalid('allergies') ? "input-error" : ""}
            >
              <option value="" disabled hidden>בחר/י...</option>
              <option value="לא">לא</option>
              <option value="כן">כן</option>
            </select>
            {formData.allergies === 'כן' && (
              <>
                <label>פירוט אלרגיה:</label>
                <textarea
                  placeholder="פרט כאן..."
                  value={formData.allergiesDetail}
                  onChange={(e) => updateField('allergiesDetail', e.target.value)}
                  onBlur={() => handleBlur('allergiesDetail')}
                  className={isFieldInvalid('allergiesDetail') ? "input-error" : ""}
                />
              </>
            )}

            <label>* הצהרת בריאות:</label>
            <select
              value={formData.healthDeclaration}
              onChange={(e) => updateField('healthDeclaration', e.target.value)}
              onBlur={() => handleBlur('healthDeclaration')}
              className={isFieldInvalid('healthDeclaration') ? "input-error" : ""}
            >
              <option value="" disabled hidden>בחר/י...</option>
              <option value="בריא/ה">בני/בתי בריא/ה</option>
              <option value="יש מגבלות">יש מגבלות רפואיות</option>
            </select>
            {formData.healthDeclaration === 'יש מגבלות' && (
              <>
                <label>פירוט מגבלה:</label>
                <textarea
                  placeholder="פרט כאן..."
                  value={formData.healthDetail}
                  onChange={(e) => updateField('healthDetail', e.target.value)}
                  onBlur={() => handleBlur('healthDetail')}
                  className={isFieldInvalid('healthDetail') ? "input-error" : ""}
                />
              </>
            )}

            <label>* אטרקציות:</label>
            <select
              value={formData.attractions}
              onChange={(e) => updateField('attractions', e.target.value)}
              onBlur={() => handleBlur('attractions')}
              className={isFieldInvalid('attractions') ? "input-error" : ""}
            >
              <option value="" disabled hidden>בחר/י...</option>
              <option value="כן">מאשר יציאה לאטרקציות</option>
              <option value="לא">לא מאשר</option>
            </select>

            <label>* ידע בשחייה:</label>
            <select
              value={formData.swim}
              onChange={(e) => updateField('swim', e.target.value)}
              onBlur={() => handleBlur('swim')}
              className={isFieldInvalid('swim') ? "input-error" : ""}
            >
              <option value="" disabled hidden>בחר/י...</option>
              <option value="כן">יודע/ת לשחות</option>
              <option value="לא">לא יודע/ת לשחות</option>
            </select>

            <label>* אופן חזרה:</label>
            <select
              value={formData.returnHome}
              onChange={(e) => updateField('returnHome', e.target.value)}
              onBlur={() => handleBlur('returnHome')}
              className={isFieldInvalid('returnHome') ? "input-error" : ""}
            >
              <option value="" disabled hidden>בחר/י...</option>
              <option value="חוזר לבד">חוזר לבד</option>
              <option value="חוזר עם מלווה">חוזר עם מלווה</option>
            </select>
          </div>
          <div className="btn-row">
            <button className="back-btn" onClick={() => setStep(2)}>חזור</button>
            <button className="next-btn" onClick={() => canGoNext(['allergies', 'healthDeclaration', 'attractions', 'swim', 'returnHome']) && setStep(4)}>המשך</button>
          </div>
        </div>
      )}{step === 4 && (
  <div className="step-box fade-in">
    <h3>דף 4: פרטי קשר והערות</h3>
    

    <div className="grid-form">
      <label>* שם הורה 1:</label>
      <input
        placeholder="שם מלא"
        value={formData.p1Name}
        onChange={(e) => updateField('p1Name', e.target.value)}
        onBlur={() => handleBlur('p1Name')}
        className={isFieldInvalid('p1Name') ? "input-error" : ""}
      />

      <label>* טלפון הורה 1:</label>
      <input
        placeholder="05XXXXXXXX"
        value={formData.p1Phone}
        onChange={(e) => updateField('p1Phone', e.target.value)}
        onBlur={() => handleBlur('p1Phone')}
        className={isFieldInvalid('p1Phone') ? "input-error" : ""}
      />

      <label>שם הורה 2:</label>
      <input
        placeholder="שם מלא"
        value={formData.p2Name}
        onChange={(e) => updateField('p2Name', e.target.value)}
      />

      <label>טלפון הורה 2:</label>
      <input
        placeholder="טלפון"
        value={formData.p2Phone}
        onChange={(e) => updateField('p2Phone', e.target.value)}
      />

      <label>* טלפון חירום:</label>
      <input
        placeholder="טלפון נוסף"
        value={formData.extraPhone}
        onChange={(e) => updateField('extraPhone', e.target.value)}
        onBlur={() => handleBlur('extraPhone')}
        className={isFieldInvalid('extraPhone') ? "input-error" : ""}
      />

      <label>נייד תלמיד:</label>
      <input
        placeholder="נייד (אופציונלי)"
        value={formData.studentPhone}
        onChange={(e) => updateField('studentPhone', e.target.value)}
      />

      <label>הערות מיוחדות:</label>
      <textarea
        placeholder="הערות למשרד..."
        value={formData.notes}
        onChange={(e) => updateField('notes', e.target.value)}
        maxLength="200"
      />
    </div>

    {/* תיבת אישור תקנון */}
    <div style={{ 
      marginTop: '20px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px', 
      padding: '10px', 
      backgroundColor: '#f9f9f9', 
      borderRadius: '8px',
      border: (!agreedToRules && touched.agreedToRules) ? "1px solid red" : "1px solid #ddd"
    }}>
      <input 
        type="checkbox" 
        id="rules" 
        checked={agreedToRules} 
        onChange={(e) => setAgreedToRules(e.target.checked)} 
        onBlur={() => setTouched({...touched, agreedToRules: true})}
        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
      />
      <label htmlFor="rules" style={{ cursor: 'pointer', fontSize: '14px' }}>
        קראתי את 
        <a href="/rules.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'underline', margin: '0 5px' }}>
          תקנון הקייטנה
        </a> 
        ואני מאשר/ת.
      </label>
    </div>

    <div className="btn-row">
      <button className="back-btn" onClick={() => setStep(3)}>חזור</button>
      <button 
        className="success-btn" 
        onClick={() => {
          const page4Fields = ['p1Name', 'p1Phone', 'extraPhone'];
          
          // 1. בדיקת שדות חובה
          if (!canGoNext(page4Fields)) {
            setGlobalError("יש למלא את כל שדות החובה המסומנים באדום");
            window.scrollTo(0, 0);
            return;
          }
          
          // 2. בדיקת תקנון - עדכון שגיאה גלובלית במקום alert
          if (!agreedToRules) {
            setGlobalError("חובה לאשר את תקנון הקייטנה כדי לסיים את הרישום");
            setTouched({...touched, agreedToRules: true});
            window.scrollTo(0, 0); 
            return;
          }

          setGlobalError(""); // ניקוי שגיאות אם הכל תקין
          saveToSQL();
        }} 
        disabled={loading}
      >
        {loading ? "שומר..." : "סיום ושמירה"}
      </button>
    </div>
  </div>
)}
      {step === 5 && (
        <div className="step-box fade-in success-mode" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h2>הרישום בוצע בהצלחה!</h2>
          <p>נתוני הילד/ה נקלטו במערכת הקייטנה.</p>
          <button className="main-btn" onClick={() => window.location.reload()}>רישום ילד נוסף</button>
        </div>
      )}

    </div>
  );
}

export default CommitteeRegistration;