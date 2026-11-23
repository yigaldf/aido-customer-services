/* Neon Peach — Mock data (fictional customers, phones and messages).
 * Dates are relative to "now" so the demo always looks fresh:
 *   when: [0, 45]        -> today, 45 minutes ago
 *   when: [3, "21:14"]   -> 3 days ago at 21:14
 *   res:  [dayOffset, "HH:MM", guests]  -> reservation day relative to today (0 = tonight)
 *   notes: [[agent, minutesAfterCreated, text], ...]
 */
window.NP_AGENTS = [
  { id: "a1", name: "דניאל", role: "מנהל משמרת", avatar: "🧔" },
  { id: "a2", name: "שירה", role: "מארחת", avatar: "👩‍🦰" },
  { id: "a3", name: "עומר", role: "ברמן ראשי", avatar: "🧑‍🎤" },
  { id: "a4", name: "מאיה", role: "שירות לקוחות", avatar: "👩" },
];

window.NP_RAW = [
  // id, when, name, phone, channel, category, priority, status, assignee, subject, message, extra
  ["BB-1001", [0, 12], "נועה לוי", "050-1234567", "whatsapp", "reservation", "medium", "new", null, "שולחן ל-8 ליום הולדת", "היי! אפשר שולחן ל-8 הערב ב-22:00? חוגגים 25 לחברה 🎂", { res: [0, "22:00", 8] }],
  ["BB-1002", [0, 25], "איתי כהן", "052-2345678", "instagram", "complaint", "high", "new", null, "המבורגר הגיע קר", "הזמנו לפני שעה, ההמבורגר הגיע קר והצ'יפס רך. לא נעים בכלל.", {}],
  ["BB-1003", [0, 40], "יעל ברק", "054-3456789", "phone", "reservation", "low", "in_progress", "שירה", "זוג בבר", "שני מקומות על הבר ב-21:30, אם אפשר ליד הדיג'יי", { res: [0, "21:30", 2], notes: [["שירה", 6, "שמרתי 2 כיסאות בבר, מקומות 4-5"]] }],
  ["BB-1004", [0, 55], "רון אזולאי", "053-4567890", "website", "event", "medium", "new", null, "מסיבת רווקות", "רוצות לסגור את הגלריה ל-20 בנות ביום שישי הבא. יש חבילת שוטים?", {}],
  ["BB-1005", [0, 80], "מיכל שטרן", "050-5678901", "whatsapp", "lost_found", "low", "in_progress", "מאיה", "ג'קט ג'ינס", "שכחתי אתמול ג'קט ג'ינס עם פאצ'ים על הכיסא ליד החלון", { notes: [["מאיה", 15, "בודקת עם צוות הניקיון"]] }],
  ["BB-1006", [0, 95], "עידו פרץ", "058-6789012", "instagram", "feedback", "low", "resolved", "מאיה", "הדיג'יי היה מטורף", "ערב הטכנו אתמול היה הכי טוב שהיה לי השנה 🔥🔥", { notes: [["מאיה", 10, "הודינו ושלחנו קוד הנחה לפעם הבאה"]], rating: 5 }],
  ["BB-1007", [0, 130], "שחר גולן", "052-7890123", "phone", "complaint", "high", "in_progress", "דניאל", "חיוב כפול באשראי", "חויבתי פעמיים על אותו חשבון של 286 ₪", { notes: [["דניאל", 20, "בודק מול חברת הסליקה"]] }],
  ["BB-1008", [0, 170], "טל מזרחי", "054-8901234", "whatsapp", "reservation", "medium", "resolved", "שירה", "שולחן ל-6 בקריוקי", "שולחן ל-6 לערב הקריוקי הערב ב-23:00", { res: [0, "23:00", 6], notes: [["שירה", 12, "אושר, שולחן 7 ליד הבמה"]], rating: 5 }],
  ["BB-1009", [0, 210], "אור דהן", "050-9012345", "website", "question", "low", "new", null, "אופציות טבעוניות", "יש לכם מנות טבעוניות? וקוקטיילים בלי ביצה?", {}],
  ["BB-1010", [0, 260], "גלעד רוזן", "053-0123456", "walk_in", "job", "low", "new", null, "מחפשים ברמנים?", "יש לי שנתיים ניסיון כברמן בפלורנטין, אשמח להשאיר קו\"ח", {}],
  ["BB-1011", [1, "23:40"], "הילה אברהם", "052-1122334", "instagram", "complaint", "high", "resolved", "דניאל", "סלקטור לא נחמד", "הסלקטור בכניסה היה גס רוח לחבר שלי", { notes: [["דניאל", 35, "שיחה עם הסלקטור + התנצלות ללקוחה, הוזמנו לשוטים עלינו"]], rating: 4 }],
  ["BB-1012", [1, "22:10"], "אלון שמש", "054-2233445", "whatsapp", "reservation", "medium", "closed", "שירה", "שולחן ל-4", "שולחן ל-4 מחר ב-21:00", { res: [0, "21:00", 4], notes: [["שירה", 8, "אושר, שולחן 3"]], rating: 5 }],
  ["BB-1013", [1, "20:30"], "דנה קפלן", "050-3344556", "phone", "event", "medium", "in_progress", "דניאל", "אירוע חברה", "אירוע צוות ל-35 איש בעוד שבועיים, צריכים הצעת מחיר", { notes: [["דניאל", 60, "נשלחה הצעה ראשונית, ממתין לאישור"]] }],
  ["BB-1014", [1, "19:05"], "יונתן לביא", "058-4455667", "website", "feedback", "low", "resolved", "מאיה", "הקוקטייל אפרסק", "ה-Peach Fizz הוא הקוקטייל הכי טוב בעיר!", { notes: [["מאיה", 25, "תודה רבה! העברנו לעומר"]], rating: 5 }],
  ["BB-1015", [1, "17:45"], "שני וקנין", "052-5566778", "whatsapp", "reservation", "low", "resolved", "שירה", "שולחן ל-3", "שולחן ל-3 בעוד יומיים ב-20:30", { res: [1, "20:30", 3], notes: [["שירה", 14, "אושר"]], rating: 4 }],
  ["BB-1016", [2, "23:55"], "עמית בן דוד", "053-6677889", "instagram", "complaint", "medium", "resolved", "עומר", "מוזיקה חזקה מדי", "אי אפשר היה לדבר בכלל בגלל הווליום", { notes: [["עומר", 45, "הוסבר שזה ערב דיג'יי, הומלץ על ימי ראשון שקטים יותר"]], rating: 3 }],
  ["BB-1017", [2, "21:20"], "נטע חדד", "054-7788990", "whatsapp", "lost_found", "medium", "resolved", "מאיה", "ארנק שחור", "איבדתי ארנק שחור עם תעודת זהות", { notes: [["מאיה", 30, "נמצא! הלקוחה אספה למחרת"]], rating: 5 }],
  ["BB-1018", [2, "20:00"], "אביב סעדה", "050-8899001", "phone", "reservation", "medium", "resolved", "שירה", "שולחן ל-10", "עשרה חברים, טריוויה ביום שלישי", { res: [-1, "21:00", 10], notes: [["שירה", 18, "אושר, שני שולחנות מחוברים"]] }],
  ["BB-1019", [2, "18:40"], "רותם אוחיון", "058-9900112", "website", "question", "low", "resolved", "מאיה", "חניה באזור", "יש חניה קרובה?", { notes: [["מאיה", 40, "נשלח קישור לחניון רוטשילד"]], rating: 4 }],
  ["BB-1020", [3, "22:45"], "ליאור נחום", "052-0011223", "instagram", "complaint", "high", "closed", "דניאל", "שוט שבור", "קיבלתי כוס שוט סדוקה וחתכתי את השפה", { notes: [["דניאל", 15, "טיפול במקום, החשבון עלינו, נבדקו כל הכוסות"]], rating: 4 }],
  ["BB-1021", [3, "21:10"], "מאור יוסף", "053-1122445", "whatsapp", "reservation", "medium", "resolved", "שירה", "דייט ראשון", "שולחן לשניים במקום רומנטי 😅", { res: [-3, "21:00", 2], notes: [["שירה", 9, "שולחן 1 בפינה, עם נר"]], rating: 5 }],
  ["BB-1022", [3, "19:30"], "קרן אלמוג", "054-2233556", "phone", "event", "medium", "resolved", "דניאל", "יום הולדת 30", "יום הולדת 30 ל-25 אורחים, צריכה עוגה", { notes: [["דניאל", 50, "סגרנו חבילה + עוגה מהקונדיטוריה"]], rating: 5 }],
  ["BB-1023", [4, "23:15"], "ניר טל", "050-3344667", "website", "complaint", "medium", "resolved", "מאיה", "המתנה ארוכה למלצר", "חיכינו 20 דקות שמישהו ייקח הזמנה", { notes: [["מאיה", 120, "התנצלות + שובר לקוקטייל"]], rating: 3 }],
  ["BB-1024", [4, "20:50"], "סתיו מלכה", "058-4455778", "whatsapp", "reservation", "low", "closed", "שירה", "שולחן ל-5", "שולחן ל-5 בשישי", { res: [-2, "22:30", 5], notes: [["שירה", 11, "אושר"]], rating: 4 }],
  ["BB-1025", [5, "22:00"], "עדי ששון", "052-5566889", "instagram", "feedback", "low", "resolved", "מאיה", "מלצרית מדהימה", "המלצרית ליה הייתה מקסימה, תנו לה העלאה 😄", { notes: [["מאיה", 60, "הועבר לליה ולדניאל"]], rating: 5 }],
  ["BB-1026", [5, "19:20"], "תומר גבאי", "053-6677990", "phone", "question", "low", "resolved", "מאיה", "גיל כניסה", "מה גיל הכניסה בסופ\"ש?", { notes: [["מאיה", 30, "18+ עם תעודה מזהה"]], rating: 4 }],
  ["BB-1027", [6, "23:30"], "ספיר רחמים", "054-7788001", "whatsapp", "complaint", "high", "resolved", "דניאל", "אלרגיה לבוטנים", "ביקשתי בלי בוטנים וקיבלתי מנה עם בוטנים!", { notes: [["דניאל", 10, "שיחה עם השף, עודכן נוהל אלרגנים"]], rating: 3 }],
  ["BB-1028", [6, "20:15"], "אריאל זכאי", "050-8899112", "website", "reservation", "medium", "resolved", "שירה", "שולחן ל-7", "שולחן ל-7 למשחק כדורגל במסך", { res: [-6, "21:45", 7], notes: [["שירה", 20, "אושר מול המסך הגדול"]], rating: 5 }],
  ["BB-1029", [7, "21:40"], "מאיה בן חיים", "058-9900223", "instagram", "event", "low", "resolved", "דניאל", "מסיבת סיום", "מסיבת סיום תואר ל-40 סטודנטים", { notes: [["דניאל", 90, "נסגר אירוע לחמישי"]], rating: 5 }],
  ["BB-1030", [7, "18:30"], "אסף ביטון", "052-0011334", "phone", "job", "low", "closed", "דניאל", "מלצר/ית", "מחפש עבודה כמלצר במשמרות ערב", { notes: [["דניאל", 240, "זומן לראיון"]] }],
  ["BB-1031", [8, "22:20"], "חן לוינסון", "053-1122556", "whatsapp", "reservation", "low", "resolved", "שירה", "שולחן ל-4", "שולחן ל-4 לערב טריוויה", { res: [-8, "21:00", 4], notes: [["שירה", 7, "אושר"]], rating: 4 }],
  ["BB-1032", [8, "20:10"], "גל שפירא", "054-2233667", "website", "complaint", "medium", "resolved", "עומר", "קוקטייל מים", "המוחיטו היה מים עם נענע", { notes: [["עומר", 55, "הוחלף מיד, שוחחנו עם הברמן"]], rating: 3 }],
  ["BB-1033", [9, "23:05"], "בר עזרא", "050-3344778", "instagram", "feedback", "low", "resolved", "מאיה", "אווירה מעולה", "המקום הכי צבעוני בתל אביב 🍑", { notes: [["מאיה", 80, "תודה!"]], rating: 5 }],
  ["BB-1034", [9, "19:50"], "יובל דגן", "058-4455889", "phone", "reservation", "medium", "closed", "שירה", "שולחן ל-6", "שולחן ל-6 ביום חמישי", { res: [-7, "22:00", 6], notes: [["שירה", 16, "אושר"]], rating: 4 }],
  ["BB-1035", [10, "21:30"], "ענבל קורן", "052-5566990", "whatsapp", "lost_found", "low", "closed", "מאיה", "אוזניות", "שכחתי איירפודס בשירותים", { notes: [["מאיה", 45, "לא נמצאו, נרשם ברשימת אבדות"]], rating: 3 }],
  ["BB-1036", [11, "22:40"], "דור אלון", "053-6677001", "website", "complaint", "medium", "resolved", "דניאל", "חשבון שגוי", "חויבנו על 3 בירות שלא הזמנו", { notes: [["דניאל", 25, "זוכה הסכום"]], rating: 4 }],
  ["BB-1037", [11, "20:00"], "שירן פרידמן", "054-7788112", "instagram", "reservation", "low", "resolved", "שירה", "שולחן ל-2", "שולחן לשניים במרפסת", { res: [-11, "20:30", 2], notes: [["שירה", 13, "אושר במרפסת"]], rating: 5 }],
  ["BB-1038", [12, "21:15"], "אלה גרוס", "050-8899223", "phone", "event", "medium", "closed", "דניאל", "השקת מוצר", "השקה של מותג בגדים ל-60 איש", { notes: [["דניאל", 120, "נסגר, הוחלט על ערב שני"]], rating: 5 }],
  ["BB-1039", [13, "23:50"], "נדב חזן", "058-9900334", "whatsapp", "complaint", "low", "closed", "עומר", "תור לשירותים", "התור לשירותים היה ארוך מאוד", { notes: [["עומר", 200, "נמסר להנהלה"]], rating: 2 }],
  ["BB-1040", [13, "19:00"], "רוני אשכנזי", "052-0011445", "website", "question", "low", "resolved", "מאיה", "הפי האוור", "עד איזו שעה ההפי האוור?", { notes: [["מאיה", 35, "18:00–20:00 בימים א'-ה'"]], rating: 5 }],
];

window.NP_QUICK_REPLIES = [
  "ההזמנה אושרה 🎉 מחכים לכם!",
  "מתנצלים מאוד 🙏 נשמח לפצות בשוט עלינו בביקור הבא 🍹",
  "מצאנו! 🔎 אפשר לאסוף מהבר מ-18:00",
  "תודה רבה על המילים החמות 💖",
];

/* Build full ticket objects relative to the current time. */
window.npBuildTickets = function () {
  const now = new Date();
  const dayAt = (offset, hhmm) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const [h, m] = hhmm.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const iso = (d) => d.toISOString();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return window.NP_RAW.map(([id, when, name, phone, channel, category, priority, status, assignee, subject, message, extra]) => {
    const created = typeof when[1] === "number"
      ? new Date(now.getTime() - when[1] * 60000)
      : dayAt(-when[0], when[1]);
    const t = {
      id, createdAt: iso(created),
      customer: { name, phone },
      channel, category, subject, message, priority, status, assignee,
      notes: (extra.notes || []).map(([by, after, text]) => ({ by, at: iso(new Date(created.getTime() + after * 60000)), text })),
      rating: extra.rating ?? null,
    };
    if (extra.res) {
      const [off, time, guests] = extra.res;
      t.reservation = { date: ymd(dayAt(off, "00:00")), time, guests };
    }
    return t;
  });
};

/* Shared dictionaries. `label` is also the choice name stored in Airtable. */
window.NP_DICT = {
  categories: {
    reservation: { label: "הזמנת מקום", emoji: "📅", color: "#FFB899", at: "orangeLight2" },
    complaint:   { label: "תלונה", emoji: "😤", color: "#FFA8B5", at: "redLight2" },
    event:       { label: "אירוע פרטי", emoji: "🎉", color: "#C9B6FF", at: "purpleLight2" },
    feedback:    { label: "משוב", emoji: "💖", color: "#B8F0E0", at: "tealLight2" },
    question:    { label: "שאלה", emoji: "❓", color: "#BFE3FF", at: "blueLight2" },
    lost_found:  { label: "אבדות ומציאות", emoji: "🔎", color: "#FFF4B8", at: "yellowLight2" },
    job:         { label: "עבודה", emoji: "🧑‍🍳", color: "#E6D3C4", at: "grayLight2" },
  },
  statuses: {
    new:         { label: "חדש", emoji: "🔵", order: 0, at: "blueLight2" },
    in_progress: { label: "בטיפול", emoji: "🟡", order: 1, at: "yellowLight2" },
    resolved:    { label: "טופל", emoji: "🟢", order: 2, at: "greenLight2" },
    closed:      { label: "סגור", emoji: "⚪", order: 3, at: "grayLight2" },
  },
  priorities: {
    high:   { label: "גבוהה", order: 0, at: "redLight2" },
    medium: { label: "בינונית", order: 1, at: "orangeLight2" },
    low:    { label: "נמוכה", order: 2, at: "greenLight2" },
  },
  channels: {
    whatsapp:  { label: "וואטסאפ", emoji: "💬", at: "greenLight2" },
    instagram: { label: "אינסטגרם", emoji: "📸", at: "pinkLight2" },
    phone:     { label: "טלפון", emoji: "📞", at: "blueLight2" },
    website:   { label: "אתר", emoji: "🌐", at: "purpleLight2" },
    walk_in:   { label: "הגעה פיזית", emoji: "🚶", at: "grayLight2" },
  },
};
