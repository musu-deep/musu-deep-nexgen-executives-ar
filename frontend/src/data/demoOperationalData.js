function createDateFactory() {
  const base = new Date();

  const shift = ({ days = 0, hours = 0, minutes = 0 } = {}) => {
    const date = new Date(base);
    date.setDate(date.getDate() + days);
    date.setHours(date.getHours() + hours);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  };

  const todayAt = (hour, minute = 0) => {
    const date = new Date(base);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  return { shift, todayAt };
}

export function getDemoOperationalData() {
  const { shift, todayAt } = createDateFactory();

  const projects = [
    { id: "demo-prj-001", name: "برنامج التحول الرقمي المتكامل", sector: "digital", status: "active", progress: 72, priority: "high", rag: "amber", budget: 2400000, end_date: shift({ days: 75 }), created_at: shift({ days: -210 }), updated_at: shift({ hours: -2 }) },
    { id: "demo-prj-002", name: "أكاديمية القيادات التنفيذية", sector: "academy", status: "active", progress: 84, priority: "medium", rag: "green", budget: 1150000, end_date: shift({ days: 42 }), created_at: shift({ days: -170 }), updated_at: shift({ hours: -5 }) },
    { id: "demo-prj-003", name: "توسعة الطاقة الإنتاجية", sector: "investment", status: "active", progress: 61, priority: "high", rag: "amber", budget: 4800000, end_date: shift({ days: 110 }), created_at: shift({ days: -260 }), updated_at: shift({ days: -1 }) },
    { id: "demo-prj-004", name: "منصة المتطوعين الموحدة", sector: "development", status: "active", progress: 48, priority: "medium", rag: "amber", budget: 950000, end_date: shift({ days: 95 }), created_at: shift({ days: -120 }), updated_at: shift({ days: -2 }) },
    { id: "demo-prj-005", name: "مركز القيادة التنفيذي", sector: "digital", status: "active", progress: 76, priority: "medium", rag: "green", budget: 1700000, end_date: shift({ days: 58 }), created_at: shift({ days: -200 }), updated_at: shift({ days: -3 }) },
    { id: "demo-prj-006", name: "برنامج التوسع في الأسواق الأفريقية", sector: "investment", status: "delayed", progress: 39, priority: "critical", rag: "red", budget: 3200000, end_date: shift({ days: -12 }), created_at: shift({ days: -300 }), updated_at: shift({ days: -4 }) },
    { id: "demo-prj-007", name: "منظومة الحوكمة والامتثال", sector: "corporate", status: "completed", progress: 100, priority: "medium", rag: "green", budget: 680000, end_date: shift({ days: -35 }), created_at: shift({ days: -240 }), updated_at: shift({ days: -6 }) },
    { id: "demo-prj-008", name: "برنامج رفع الكفاءة التشغيلية", sector: "arak_development", status: "active", progress: 67, priority: "medium", rag: "green", budget: 900000, end_date: shift({ days: 65 }), created_at: shift({ days: -150 }), updated_at: shift({ days: -7 }) },
    { id: "demo-prj-009", name: "استراتيجية الاستثمار 2027", sector: "investment", status: "active", progress: 54, priority: "high", rag: "amber", budget: 750000, end_date: shift({ days: 88 }), created_at: shift({ days: -115 }), updated_at: shift({ days: -8 }) },
    { id: "demo-prj-010", name: "تطوير سلاسل الإمداد", sector: "arak_development", status: "on_hold", progress: 31, priority: "high", rag: "red", budget: 2100000, end_date: shift({ days: 28 }), created_at: shift({ days: -190 }), updated_at: shift({ days: -9 }) },
    { id: "demo-prj-011", name: "برنامج التميز المؤسسي", sector: "development", status: "active", progress: 81, priority: "medium", rag: "green", budget: 620000, end_date: shift({ days: 34 }), created_at: shift({ days: -130 }), updated_at: shift({ days: -10 }) },
    { id: "demo-prj-012", name: "بوابة إدارة الشراكات", sector: "corporate", status: "planned", progress: 12, priority: "low", rag: "gray", budget: 450000, end_date: shift({ days: 150 }), created_at: shift({ days: -40 }), updated_at: shift({ days: -11 }) },
    { id: "demo-prj-013", name: "مشروع تصفية المخزون الراكد", sector: "arak_development", status: "active", progress: 43, priority: "critical", rag: "red", budget: 350000, end_date: shift({ days: 18 }), created_at: shift({ days: -95 }), updated_at: shift({ days: -12 }) },
    { id: "demo-prj-014", name: "تحديث الهوية المؤسسية", sector: "corporate", status: "completed", progress: 100, priority: "medium", rag: "green", budget: 280000, end_date: shift({ days: -20 }), created_at: shift({ days: -100 }), updated_at: shift({ days: -14 }) },
  ];

  const tasks = [
    { id: "demo-tsk-001", project_id: "demo-prj-001", title: "اعتماد معمارية التكامل", status: "completed", priority: "high", due_date: shift({ days: -18 }), updated_at: shift({ hours: -3 }) },
    { id: "demo-tsk-002", project_id: "demo-prj-001", title: "ربط لوحة القيادة بمصادر البيانات", status: "in_progress", priority: "high", due_date: shift({ days: 5 }), updated_at: shift({ hours: -4 }) },
    { id: "demo-tsk-003", project_id: "demo-prj-001", title: "اختبار صلاحيات المستخدمين", status: "awaiting_approval", priority: "medium", due_date: shift({ days: 9 }), updated_at: shift({ hours: -6 }) },
    { id: "demo-tsk-004", project_id: "demo-prj-002", title: "إغلاق الحزمة التدريبية الأولى", status: "completed", priority: "medium", due_date: shift({ days: -9 }), updated_at: shift({ days: -1 }) },
    { id: "demo-tsk-005", project_id: "demo-prj-002", title: "تنفيذ جلسة القيادات العليا", status: "in_progress", priority: "high", due_date: shift({ days: 2 }), updated_at: shift({ days: -1 }) },
    { id: "demo-tsk-006", project_id: "demo-prj-003", title: "توريد خط الإنتاج الإضافي", status: "in_progress", priority: "high", due_date: shift({ days: 21 }), updated_at: shift({ days: -2 }) },
    { id: "demo-tsk-007", project_id: "demo-prj-003", title: "اعتماد خطة التشغيل التجريبي", status: "pending", priority: "medium", due_date: shift({ days: 35 }), updated_at: shift({ days: -2 }) },
    { id: "demo-tsk-008", project_id: "demo-prj-004", title: "إكمال سجل فرص التطوع", status: "in_progress", priority: "medium", due_date: shift({ days: 6 }), updated_at: shift({ days: -2 }) },
    { id: "demo-tsk-009", project_id: "demo-prj-004", title: "إطلاق تجربة المستخدم المغلقة", status: "pending", priority: "medium", due_date: shift({ days: 14 }), updated_at: shift({ days: -3 }) },
    { id: "demo-tsk-010", project_id: "demo-prj-005", title: "توحيد مؤشرات الأداء التنفيذية", status: "completed", priority: "high", due_date: shift({ days: -12 }), updated_at: shift({ days: -3 }) },
    { id: "demo-tsk-011", project_id: "demo-prj-005", title: "تفعيل التنبيهات الاستباقية", status: "in_progress", priority: "high", due_date: shift({ days: 4 }), updated_at: shift({ days: -3 }) },
    { id: "demo-tsk-012", project_id: "demo-prj-006", title: "توقيع اتفاقية الشريك المحلي", status: "delayed", priority: "critical", due_date: shift({ days: -16 }), updated_at: shift({ days: -4 }) },
    { id: "demo-tsk-013", project_id: "demo-prj-006", title: "اعتماد نموذج الدخول للسوق", status: "delayed", priority: "high", due_date: shift({ days: -8 }), updated_at: shift({ days: -4 }) },
    { id: "demo-tsk-014", project_id: "demo-prj-007", title: "اعتماد مصفوفة الصلاحيات", status: "completed", priority: "high", due_date: shift({ days: -40 }), updated_at: shift({ days: -6 }) },
    { id: "demo-tsk-015", project_id: "demo-prj-007", title: "نشر سياسات الحوكمة", status: "completed", priority: "medium", due_date: shift({ days: -32 }), updated_at: shift({ days: -6 }) },
    { id: "demo-tsk-016", project_id: "demo-prj-008", title: "تحليل زمن دورة الطلبات", status: "completed", priority: "medium", due_date: shift({ days: -7 }), updated_at: shift({ days: -7 }) },
    { id: "demo-tsk-017", project_id: "demo-prj-008", title: "تنفيذ تحسينات الإجراءات", status: "in_progress", priority: "high", due_date: shift({ days: 11 }), updated_at: shift({ days: -7 }) },
    { id: "demo-tsk-018", project_id: "demo-prj-009", title: "استكمال تقييم الفرص الاستثمارية", status: "in_progress", priority: "high", due_date: shift({ days: 8 }), updated_at: shift({ days: -8 }) },
    { id: "demo-tsk-019", project_id: "demo-prj-009", title: "عرض المحفظة على لجنة الاستثمار", status: "awaiting_approval", priority: "high", due_date: shift({ days: 16 }), updated_at: shift({ days: -8 }) },
    { id: "demo-tsk-020", project_id: "demo-prj-010", title: "تسوية عقد المورد الرئيسي", status: "delayed", priority: "critical", due_date: shift({ days: -20 }), updated_at: shift({ days: -9 }) },
    { id: "demo-tsk-021", project_id: "demo-prj-010", title: "إعادة جدولة التوريدات", status: "pending", priority: "high", due_date: shift({ days: -2 }), updated_at: shift({ days: -9 }) },
    { id: "demo-tsk-022", project_id: "demo-prj-011", title: "تنفيذ التقييم المؤسسي", status: "completed", priority: "medium", due_date: shift({ days: -11 }), updated_at: shift({ days: -10 }) },
    { id: "demo-tsk-023", project_id: "demo-prj-011", title: "إغلاق فرص التحسين ذات الأولوية", status: "in_progress", priority: "high", due_date: shift({ days: 7 }), updated_at: shift({ days: -10 }) },
    { id: "demo-tsk-024", project_id: "demo-prj-012", title: "اعتماد نطاق البوابة", status: "pending", priority: "medium", due_date: shift({ days: 19 }), updated_at: shift({ days: -11 }) },
    { id: "demo-tsk-025", project_id: "demo-prj-013", title: "تسعير حزمة المخزون الأولى", status: "completed", priority: "high", due_date: shift({ days: -6 }), updated_at: shift({ days: -12 }) },
    { id: "demo-tsk-026", project_id: "demo-prj-013", title: "إغلاق اتفاقية المشتري الاستراتيجي", status: "delayed", priority: "critical", due_date: shift({ days: -5 }), updated_at: shift({ days: -12 }) },
    { id: "demo-tsk-027", project_id: "demo-prj-013", title: "تحديث تقرير العائد المتوقع", status: "in_progress", priority: "high", due_date: shift({ days: 3 }), updated_at: shift({ days: -12 }) },
    { id: "demo-tsk-028", project_id: "demo-prj-014", title: "تسليم دليل الهوية", status: "completed", priority: "medium", due_date: shift({ days: -24 }), updated_at: shift({ days: -14 }) },
    { id: "demo-tsk-029", project_id: "demo-prj-014", title: "تحديث القوالب المؤسسية", status: "completed", priority: "medium", due_date: shift({ days: -21 }), updated_at: shift({ days: -14 }) },
    { id: "demo-tsk-030", project_id: "demo-prj-003", title: "مراجعة جاهزية الموقع", status: "pending", priority: "high", due_date: shift({ days: -1 }), updated_at: shift({ days: -2 }) },
  ];

  const meetings = [
    { id: "demo-mtg-001", title: "اجتماع مراجعة الأداء الأسبوعي", date: todayAt(10, 0), location: "قاعة القيادة التنفيذية", status: "scheduled" },
    { id: "demo-mtg-002", title: "لجنة الاستثمار والمشروعات الحرجة", date: todayAt(13, 30), location: "اجتماع مرئي", status: "scheduled" },
    { id: "demo-mtg-003", title: "متابعة التحول الرقمي", date: todayAt(16, 0), location: "مكتب الرئيس التنفيذي", status: "scheduled" },
  ];

  const requests = [
    { id: "demo-req-001", subject: "اعتماد العرض النهائي للشريك التقني", requester_name: "مدير التحول الرقمي", status: "pending", created_at: shift({ hours: -4 }) },
    { id: "demo-req-002", subject: "مناقشة خطة التوسع في غرب أفريقيا", requester_name: "نائب الرئيس للاستثمار", status: "pending", created_at: shift({ days: -1 }) },
    { id: "demo-req-003", subject: "اعتماد إجراءات تصفية المخزون", requester_name: "مدير العمليات", status: "pending", created_at: shift({ days: -2 }) },
    { id: "demo-req-004", subject: "مراجعة برنامج القيادات التنفيذية", requester_name: "مدير الأكاديمية", status: "approved", created_at: shift({ days: -3 }) },
  ];

  return { projects, tasks, meetings, requests };
}
