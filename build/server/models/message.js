// Generated by CoffeeScript 1.8.0
var Message, americano;

americano = require('americano-cozy');

module.exports = Message = americano.getModel('Message', {
  account: String,
  mailboxIDs: function(x) {
    return x;
  },
  subject: String,
  from: function(x) {
    return x;
  },
  to: function(x) {
    return x;
  },
  cc: function(x) {
    return x;
  },
  replyTo: function(x) {
    return x;
  },
  text: String,
  html: String,
  date: Date,
  inReplyTo: String,
  references: String,
  createdAt: Date,
  priority: String
});

Message.getByMailboxAndDate = function(mailboxID, callback) {
  var options;
  options = {
    startkey: [mailboxID, {}],
    endkey: [mailboxID],
    include_docs: true,
    descending: true
  };
  return Message.rawRequest('byMailboxAndDate', options, function(err, results) {
    if (err) {
      return callback(err);
    }
    return callback(null, results.map(function(item) {
      return new Message(item.doc);
    }));
  });
};

Message.destroyByMailbox = function(mailboxID, callback) {
  return Message.requestDestroy('byMailbox', {
    key: mailboxID
  }, callback);
};

require('bluebird').promisifyAll(Message, {
  suffix: 'Promised'
});

require('bluebird').promisifyAll(Message.prototype, {
  suffix: 'Promised'
});
