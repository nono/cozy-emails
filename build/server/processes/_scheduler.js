// Generated by CoffeeScript 1.10.0
var ApplicationStartup, EventEmitter, HOUR, MIN, MailboxRefresh, MailboxRefreshList, OrphanRemoval, RemoveMessagesFromAccount, Scheduler, _, async, eventEmitter, lastAllRefresh, lastFavoriteRefresh, log, queued, ramStore, running;

log = require('../utils/logging')('processes:scheduler');

ramStore = require('../models/store_account_and_boxes');

EventEmitter = require('events').EventEmitter;

MailboxRefresh = require('./mailbox_refresh');

MailboxRefreshList = require('../processes/mailbox_refresh_list');

ApplicationStartup = require('./application_startup');

RemoveMessagesFromAccount = require('./message_remove_by_account');

OrphanRemoval = require('./orphan_removal');

async = require('async');

running = null;

queued = [];

lastAllRefresh = 0;

lastFavoriteRefresh = 0;

MIN = 60 * 1000;

HOUR = 60 * MIN;

_ = require('lodash');

eventEmitter = new EventEmitter();

Scheduler = module.exports;

Scheduler.ASAP = {
  Symbol: 'ASAP'
};

Scheduler.LATER = {
  Symbol: 'LATER'
};

Scheduler.schedule = function(proc, asap, callback) {
  var ref;
  if (!callback) {
    ref = [Scheduler.ASAP, asap], asap = ref[0], callback = ref[1];
  }
  if (proc.finished) {
    throw new Error('scheduling of finished process');
  } else {
    proc.addCallback(callback);
    if (asap === Scheduler.ASAP) {
      if (running != null ? running.abortable : void 0) {
        return running.abort(function() {
          queued.unshift(running.clone());
          queued.unshift(proc);
          running = null;
          return Scheduler.doNext();
        });
      } else if (running) {
        return queued.unshift(proc);
      } else {
        queued.unshift(proc);
        return Scheduler.doNext();
      }
    } else {
      queued.push(proc);
      if (!running) {
        return Scheduler.doNext();
      }
    }
  }
};

Scheduler.scheduleMultiple = function(processes, callback) {
  var waiters;
  waiters = processes.map(function(proc) {
    return function(cb) {
      return Scheduler.schedule(proc, cb);
    };
  });
  return async.parallel(waiters, callback);
};

Scheduler.doNext = function() {
  var proc;
  log.debug("Scheduler.doNext already running = ", running != null);
  if (!running) {
    proc = running = queued.shift();
    if (proc) {
      proc.run(function(err) {
        log.debug("process finished " + proc.id + " " + err);
        running = null;
        return setImmediate(Scheduler.doNext);
      });
    } else {
      Scheduler.onIdle();
    }
    return eventEmitter.emit('change');
  }
};

Scheduler.onIdle = function() {
  log.debug("Scheduler.onIdle");
  if (lastAllRefresh < Date.now() - 1 * HOUR) {
    return Scheduler.startAllRefresh();
  } else if (lastFavoriteRefresh < Date.now() - 5 * MIN) {
    return Scheduler.startFavoriteRefresh();
  } else {
    log.debug("nothing to do, waiting 10 MIN");
    return setTimeout(Scheduler.doNext, 10 * MIN);
  }
};

Scheduler.refreshNow = function(mailbox, callback) {
  var alreadyScheduled, isSameBoxRefresh, refresh;
  isSameBoxRefresh = function(processus) {
    return processus instanceof MailboxRefresh && processus.mailbox === mailbox;
  };
  if (running && isSameBoxRefresh(running)) {
    return running.addCallback(callback);
  } else {
    alreadyScheduled = queued.filter(isSameBoxRefresh)[0];
    if (alreadyScheduled) {
      queued = _.without(queued, alreadyScheduled);
    }
    refresh = new MailboxRefresh({
      mailbox: mailbox
    });
    return Scheduler.schedule(refresh, Scheduler.ASAP, callback);
  }
};

Scheduler.startAllRefresh = function(done) {
  var refreshLists;
  log.debug("Scheduler.startAllRefresh");
  refreshLists = ramStore.getAllAccounts().map(function(account) {
    return new MailboxRefreshList({
      account: account
    });
  });
  return Scheduler.scheduleMultiple(refreshLists, function(err) {
    var refreshMailboxes;
    if (err) {
      log.error(err);
    }
    refreshMailboxes = ramStore.getAllMailboxes().map(function(mailbox) {
      return new MailboxRefresh({
        mailbox: mailbox
      });
    });
    return Scheduler.scheduleMultiple(refreshMailboxes, function(err) {
      if (err) {
        log.error(err);
      }
      lastFavoriteRefresh = Date.now();
      lastAllRefresh = Date.now();
      return typeof done === "function" ? done(err) : void 0;
    });
  });
};

Scheduler.startFavoriteRefresh = function() {
  var processes;
  log.debug("Scheduler.startFavoriteRefresh");
  processes = ramStore.getFavoriteMailboxes().map(function(mailbox) {
    return new MailboxRefresh({
      mailbox: mailbox
    });
  });
  return Scheduler.scheduleMultiple(processes, function(err) {
    if (err) {
      log.error(err);
    }
    return lastFavoriteRefresh = Date.now();
  });
};

Scheduler.on = function(event, listener) {
  return eventEmitter.addListener(event, listener);
};

Scheduler.clientSummary = function() {
  var list;
  list = queued;
  if (running) {
    list = [running].concat(list);
  }
  return list.map(function(proc) {
    return proc.summary();
  });
};

Scheduler.applicationStartupRunning = function() {
  return running && running instanceof ApplicationStartup;
};

Scheduler.orphanRemovalDebounced = function(accountID) {
  var alreadyQueued;
  if (accountID) {
    Scheduler.schedule(new RemoveMessagesFromAccount({
      accountID: accountID
    }), function(err) {
      if (err) {
        return log.error(err);
      }
    });
  }
  alreadyQueued = queued.some(function(proc) {
    return proc instanceof OrphanRemoval;
  });
  if (!alreadyQueued) {
    return Scheduler.schedule(new OrphanRemoval(), function(err) {
      if (err) {
        return log.error(err);
      }
    });
  }
};

ramStore.on('new-orphans', Scheduler.orphanRemovalDebounced);
