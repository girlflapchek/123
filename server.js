const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');

const app = express();

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/news_site', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Модели
const User = require('./models/user');
const Article = require('./models/article');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Настройка сессий и Passport
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Стратегия Passport
passport.use(new LocalStrategy({
    usernameField: 'email'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user) return done(null, false, { message: 'Пользователь не найден' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Неверный пароль' });
        
        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Middleware для проверки аутентификации
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: 'Не авторизован' });
}

// Middleware для проверки роли администратора
function isAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') return next();
    res.status(403).json({ message: 'Доступ запрещен' });
}

// Маршруты API
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Пользователь уже существует' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            email,
            password: hashedPassword,
            role: 'user'
        });
        
        await newUser.save();
        res.status(201).json({ message: 'Пользователь зарегистрирован' });
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/api/login', passport.authenticate('local'), (req, res) => {
    res.json({ message: 'Успешный вход', user: req.user });
});

app.get('/api/logout', (req, res) => {
    req.logout();
    res.json({ message: 'Успешный выход' });
});

app.get('/api/user', isAuthenticated, (req, res) => {
    res.json(req.user);
});

// Маршруты для статей
app.post('/api/articles', isAuthenticated, async (req, res) => {
    try {
        const { title, content, category } = req.body;
        const newArticle = new Article({
            title,
            content,
            category,
            author: req.user._id,
            status: 'pending' // pending, approved, rejected
        });
        
        await newArticle.save();
        res.status(201).json(newArticle);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Админские маршруты
app.get('/api/admin/articles', isAdmin, async (req, res) => {
    try {
        const articles = await Article.find({ status: 'pending' }).populate('author', 'email');
        res.json(articles);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.put('/api/admin/articles/:id', isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const article = await Article.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        
        res.json(article);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});