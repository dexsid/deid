import type { Locale } from "../../../lib/i18n";

const messages = {
  ru: {
    title: "Панель автора", login: "Вход для автора", email: "Электронная почта", password: "Пароль",
    submit: "Войти", pending: "Проверяем…", logout: "Выйти", loggingOut: "Выходим…",
    intro: "Управление личным пространством Deid.", private: "Вход доступен только владельцу. Публичной регистрации нет.",
    unavailable: "Вход пока не настроен", setup: "Для доступа требуется локальная настройка авторизации и создание аккаунта владельца. Публичные разделы доступны без входа.",
    failed: "Не удалось войти. Проверьте данные и повторите попытку.", network: "Не удалось связаться с сервером. Повторите попытку.",
    logoutFailed: "Не удалось выйти. Повторите попытку.", empty: "Рабочее пространство готовится", emptyBody: "Вход защищён. Управление публикациями появится на следующем этапе разработки.", home: "На главную",
  },
  en: {
    title: "Author dashboard", login: "Author sign in", email: "Email", password: "Password",
    submit: "Sign in", pending: "Checking…", logout: "Sign out", loggingOut: "Signing out…",
    intro: "Manage your personal Deid space.", private: "Access is reserved for the owner. Public registration is unavailable.",
    unavailable: "Sign in is not configured yet", setup: "Access requires local authentication setup and creation of the owner account. Public sections are available without signing in.",
    failed: "Unable to sign in. Check your details and try again.", network: "Unable to reach the server. Please try again.",
    logoutFailed: "Unable to sign out. Please try again.", empty: "Your workspace is taking shape", emptyBody: "Sign in is protected. Publication management will be added in the next development stage.", home: "Back to home",
  },
  kk: {
    title: "Автор панелі", login: "Автордың кіруі", email: "Электрондық пошта", password: "Құпиясөз",
    submit: "Кіру", pending: "Тексерілуде…", logout: "Шығу", loggingOut: "Шығуда…",
    intro: "Deid жеке кеңістігін басқару.", private: "Тек иесі кіре алады. Ашық тіркелу қарастырылмаған.",
    unavailable: "Кіру әлі бапталмаған", setup: "Кіру үшін авторизацияны жергілікті ортада баптап, иесінің аккаунтын жасау қажет. Ашық бөлімдерге кірудің қажеті жоқ.",
    failed: "Кіру мүмкін болмады. Деректерді тексеріп, қайталап көріңіз.", network: "Сервермен байланысу мүмкін болмады. Қайталап көріңіз.",
    logoutFailed: "Шығу мүмкін болмады. Қайталап көріңіз.", empty: "Жұмыс кеңістігі дайындалуда", emptyBody: "Кіру қорғалған. Жарияланымдарды басқару келесі әзірлеу кезеңінде қосылады.", home: "Басты бетке",
  },
} as const;

export function adminMessages(locale: Locale) { return messages[locale]; }
