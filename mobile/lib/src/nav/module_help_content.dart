import '../theme/module_colors.dart';

typedef HelpContent = ({String title, List<String> items});

/// One consolidated help entry per bottom-nav destination — not one per
/// web page, since mobile's sub-pages are tabs within a single screen
/// (Finance's Wallets/Categories/Transactions/Budgets), not separate
/// routes. Content is a condensed version of the corresponding
/// apps/web/src/messages/fa.json "HelpGuide" entries. Hardcoded Persian
/// literals, matching every other string in mobile/lib/ today — the app
/// has no i18n/ARB system, and adding one is unrelated infrastructure
/// scope this feature doesn't need.
///
/// An exhaustive `switch`, not a `Map`, deliberately: `ModuleKey` has six
/// values but only five are bottom-nav destinations (see AppShell), so a
/// Map would need either a missing entry (a force-unwrap crash waiting to
/// happen the moment something new indexes it) or a silently-wrong
/// fallback. A switch makes the analyzer refuse to compile the moment a
/// new ModuleKey value is added without a decision for it here.
HelpContent helpContentFor(ModuleKey key) => switch (key) {
  ModuleKey.notifications => throw StateError(
    'ModuleKey.notifications is not a bottom-nav destination (see '
    'ADR-0015) and has no help content of its own.',
  ),
  ModuleKey.finance => (
    title: 'راهنمای مالی',
    items: [
      'خلاصه مالی شما را نشان می‌دهد: موجودی کل، وضعیت کیف‌پول‌ها، هزینه بر اساس دسته‌بندی و بودجه‌های این ماه.',
      'از تب‌های بالا به کیف‌پول‌ها، دسته‌بندی‌ها، تراکنش‌ها و بودجه‌ها دسترسی دارید.',
      'موجودی هر کیف‌پول از روی تراکنش‌های ثبت‌شده محاسبه می‌شود، نه یک عدد ثابت.',
      'با ثبت هزینه‌ای بیش از سقف بودجه، یک اعلان دریافت خواهید کرد.',
    ],
  ),
  ModuleKey.tasks => (
    title: 'راهنمای وظایف',
    items: [
      'کارهای خود را با وضعیت (انجام‌نشده، در حال انجام، انجام‌شده) و اولویت مدیریت کنید.',
      'هر وظیفه را می‌توانید به یک پروژه و چند برچسب اختصاص دهید — از تب‌های بالا به پروژه‌ها و برچسب‌ها دسترسی دارید.',
      'زیروظیفه‌ها و ددلاین از داخل هر وظیفه قابل مدیریت‌اند.',
    ],
  ),
  ModuleKey.habits => (
    title: 'راهنمای عادت‌ها',
    items: [
      'عادت‌های روزانه یا هفتگی خود را تعریف کنید و هر روز که انجامشان دادید علامت بزنید.',
      'رکورد (استریک) به‌صورت خودکار از روی سابقه علامت‌گذاری‌ها محاسبه می‌شود.',
      'با باز کردن تقویم ماهانه هر عادت می‌توانید روزهای گذشته را هم علامت بزنید یا بردارید.',
    ],
  ),
  ModuleKey.calendar => (
    title: 'راهنمای تقویم',
    items: [
      'رویدادها، ددلاین وظایف و تعطیلات رسمی را در یک‌جا ببینید.',
      'بین نمای «فهرست» و «هفته» جابه‌جا شوید.',
      'برای ویرایش یا حذف یک رویداد روی آن بزنید؛ وظایف و تعطیلات فقط نمایشی هستند.',
    ],
  ),
  ModuleKey.reports => (
    title: 'راهنمای گزارش‌ها',
    items: [
      'خلاصه‌ای ترکیبی از وضعیت مالی و وظایف هر ماه را نشان می‌دهد.',
      'برای جزئیات کامل هر بخش، به تب مالی یا وظایف مراجعه کنید.',
    ],
  ),
};
