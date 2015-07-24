// Generated by CoffeeScript 1.9.0
var cozydb, emit;

cozydb = require('cozydb');

emit = null;

module.exports = {
  settings: {
    all: cozydb.defaultRequests.all
  },
  account: {
    all: cozydb.defaultRequests.all
  },
  contact: {
    all: cozydb.defaultRequests.all,
    mailByName: function(doc) {
      var dp, _i, _len, _ref, _results;
      if ((doc.fn != null) && doc.fn.length > 0) {
        emit(doc.fn, doc);
      }
      if (doc.n != null) {
        emit(doc.n.split(';').join(' ').trim(), doc);
      }
      _ref = doc.datapoints;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        dp = _ref[_i];
        if (dp.name === 'email') {
          emit(dp.value, doc);
          _results.push(emit(dp.value.split('@')[1], doc));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    },
    mailByEmail: function(doc) {
      var dp, _i, _len, _ref, _results;
      _ref = doc.datapoints;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        dp = _ref[_i];
        if (dp.name === 'email') {
          _results.push(emit(dp.value, doc));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    }
  },
  mailbox: {
    treeMap: function(doc) {
      return emit([doc.accountID].concat(doc.tree), null);
    }
  },
  message: {
    totalUnreadByAccount: {
      reduce: '_count',
      map: function(doc) {
        if (!doc.ignoreInCount && -1 === doc.flags.indexOf('\\Seen')) {
          return emit(doc.accountID, null);
        }
      }
    },
    byMailboxRequest: {
      reduce: '_count',
      map: function(doc) {
        var boxid, dest, dests, docDate, nobox, sender, uid, xflag, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3;
        nobox = true;
        _ref = doc.mailboxIDs;
        for (boxid in _ref) {
          uid = _ref[boxid];
          nobox = false;
          docDate = doc.date || (new Date()).toISOString();
          emit(['uid', boxid, uid], doc.flags);
          emit(['date', boxid, null, docDate], null);
          _ref1 = ['\\Seen', '\\Flagged', '\\Answered'];
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            xflag = _ref1[_i];
            if (-1 === doc.flags.indexOf(xflag)) {
              xflag = '!' + xflag;
            }
            emit(['date', boxid, xflag, docDate], null);
          }
          if (((_ref2 = doc.attachments) != null ? _ref2.length : void 0) > 0) {
            emit(['date', boxid, '\\Attachments', docDate], null);
          }
          _ref3 = doc.from;
          for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
            sender = _ref3[_j];
            if (sender.name != null) {
              emit(['from', boxid, null, sender.name, docDate], null);
            }
            emit(['from', boxid, null, sender.address, docDate], null);
          }
          dests = [];
          if (doc.to != null) {
            dests = dests.concat(doc.to);
          }
          if (doc.cc != null) {
            dests = dests.concat(doc.cc);
          }
          for (_k = 0, _len2 = dests.length; _k < _len2; _k++) {
            dest = dests[_k];
            if (dest.name != null) {
              emit(['dest', boxid, null, dest.name, docDate], null);
            }
            emit(['dest', boxid, null, dest.address, docDate], null);
          }
        }
        void 0;
        if (nobox) {
          return emit(['nobox']);
        }
      }
    },
    dedupRequest: function(doc) {
      if (doc.messageID) {
        emit([doc.accountID, 'mid', doc.messageID], doc.conversationID);
      }
      if (doc.normSubject) {
        return emit([doc.accountID, 'subject', doc.normSubject], doc.conversationID);
      }
    },
    conversationPatching: {
      reduce: function(key, values, rereduce) {
        var value, valuesShouldNotBe, _i, _len;
        valuesShouldNotBe = rereduce ? null : values[0];
        for (_i = 0, _len = values.length; _i < _len; _i++) {
          value = values[_i];
          if (value !== valuesShouldNotBe) {
            return value;
          }
        }
        return null;
      },
      map: function(doc) {
        var reference, _i, _len, _ref, _results;
        if (doc.messageID) {
          emit([doc.accountID, doc.messageID], doc.conversationID);
        }
        _ref = doc.references || [];
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          reference = _ref[_i];
          _results.push(emit([doc.accountID, reference], doc.conversationID));
        }
        return _results;
      }
    },
    byConversationID: {
      reduce: '_count',
      map: function(doc) {
        if (doc.conversationID && !doc.ignoreInCount) {
          return emit(doc.conversationID);
        }
      }
    }
  }
};
