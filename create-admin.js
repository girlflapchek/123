const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/user');

mongoose.connect('mongodb://localhost:27017/news_site', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function createAdmin() {
    const email = 'admin@ad.com';
    const password = '123';
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = new User({
        email,
        password: hashedPassword,
        role: 'admin'
    });
    
    await admin.save();
    console.log('Администратор создан');
    mongoose.connection.close();
}

createAdmin().catch(err => {
    console.error(err);
    mongoose.connection.close();
});