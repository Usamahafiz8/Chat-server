const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    fullName: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    // password: {
    //     type: String,
    //     required: true,
    // },
    role: {
        type: String,
        enum: ['admin', 'guest', 'storeOwner'],
        default: 'guest',
    },
    token: {
        type: String
    }
});

const Users = mongoose.model('User', userSchema);

module.exports = Users;
