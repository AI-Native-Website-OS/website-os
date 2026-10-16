package com.sinounion.translation;

/** 请求级目标语言（由 LocaleInterceptor 设置，ResponseBodyAdvice/覆盖服务读取）。 */
public final class LocaleContext {

    private static final ThreadLocal<String> LOCALE = new ThreadLocal<>();

    private LocaleContext() {
    }

    public static void set(String locale) {
        LOCALE.set(locale);
    }

    public static String get() {
        return LOCALE.get();
    }

    public static void clear() {
        LOCALE.remove();
    }
}
