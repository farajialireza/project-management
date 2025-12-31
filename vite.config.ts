
import { defineConfig, loadEnv } from 'vite';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  // بارگذاری فایل‌های env بر اساس حالت فعلی (development, production و غیره)
  // پارامتر سوم '' باعث می‌شود تمامی متغیرها (بدون نیاز به پیشوند VITE_) بارگذاری شوند
  // Fix: Use process.cwd() instead of the non-existent named export cwd().
  const env = loadEnv(mode, process.cwd(), '');

  // تبدیل رشته دامنه‌ها به آرایه‌ای از رشته‌ها
  // در صورتی که متغیری تعریف نشده باشد، به صورت پیش‌فرض localhost مجاز است
  const allowedHosts = env.ALLOWED_DOMAINS 
    ? env.ALLOWED_DOMAINS.split(',').map(host => host.trim()) 
    : ['localhost', '127.0.0.1'];

  return {
    server: {
      // تنظیم دامنه‌های مجاز برای دسترسی به سرور توسعه
      allowedHosts: allowedHosts,
      // سایر تنظیمات سرور در صورت نیاز
      host: true, // اجازه دسترسی از طریق IP شبکه
      port: 5173,
    },
    preview: {
      // تنظیم پورت برای حالت پیش‌نمایش (بعد از بیلد)
      host: true,
      port: 5173,
    },
    // در صورتی که از پلاگین‌های دیگر مثل React استفاده می‌کنید اینجا اضافه شود
  };
});
