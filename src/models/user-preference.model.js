// notification-service/src/models/user-preference.model.js
const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    enabled: {
      type: Boolean,
      default: true
    },
    address: {
      type: String,
      validate: {
        validator: function(v) {
          return /^\S+@\S+\.\S+$/.test(v);
        },
        message: props => `${props.value} is not a valid email address!`
      }
    }
  },
  sms: {
    enabled: {
      type: Boolean,
      default: false
    },
    phoneNumber: {
      type: String
    }
  },
  push: {
    enabled: {
      type: Boolean,
      default: true
    },
    deviceTokens: [{
      type: String
    }]
  },
  notificationTypes: {
    ORDER_EXECUTED: {
      type: Boolean,
      default: true
    },
    STOP_LOSS: {
      type: Boolean,
      default: true
    },
    TAKE_PROFIT: {
      type: Boolean,
      default: true
    },
    STRATEGY_STARTED: {
      type: Boolean,
      default: true
    },
    STRATEGY_STOPPED: {
      type: Boolean,
      default: true
    },
    ERROR: {
      type: Boolean,
      default: true
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = UserPreference;