// Generated by CoffeeScript 1.7.1
var IGNORE_ATTRIBUTES, REGEXP, flattenMailboxTreeLevel, _;

_ = require('lodash');

REGEXP = {
  hasReOrFwD: /^(Re|Fwd)/i,
  subject: /(?:(?:Re|Fwd)(?:\[[\d+]\])?\s?:\s?)*(.*)/i,
  messageId: /<([^<>]+)>/
};

IGNORE_ATTRIBUTES = ['\\HasNoChildren', '\\HasChildren'];

module.exports = {
  isReplyOrForward: function(subject) {
    var match;
    match = subject.match(REGEXP.hasReOrFwD);
    if (match) {
      return true;
    } else {
      return false;
    }
  },
  normalizeSubject: function(subject) {
    var match;
    match = subject.match(REGEXP.subject);
    if (match) {
      return match[1];
    } else {
      return false;
    }
  },
  normalizeMessageID: function(messageId) {
    var match;
    match = messageId.match(REGEXP.messageId);
    if (match) {
      return match[1];
    } else {
      return null;
    }
  },
  flattenMailboxTree: function(tree) {
    var boxes, delimiter, path, root;
    boxes = [];
    if (Object.keys(tree).length === 1 && (root = tree['INBOX'])) {
      delimiter = root.delimiter;
      path = 'INBOX' + delimiter;
      flattenMailboxTreeLevel(boxes, root.children, path, [], delimiter);
    } else {
      flattenMailboxTreeLevel(boxes, tree, '', [], '/');
    }
    return boxes;
  }
};

flattenMailboxTreeLevel = function(boxes, children, pathStr, pathArr, parentDelimiter) {
  var child, delimiter, name, subPathArr, subPathStr, _results;
  _results = [];
  for (name in children) {
    child = children[name];
    delimiter = child.delimiter || parentDelimiter;
    subPathStr = pathStr + name + delimiter;
    subPathArr = pathArr.concat(name);
    flattenMailboxTreeLevel(boxes, child.children, subPathStr, subPathArr, delimiter);
    _results.push(boxes.push({
      label: name,
      delimiter: delimiter,
      path: pathStr + name,
      tree: subPathArr,
      attribs: _.difference(child.attribs, IGNORE_ATTRIBUTES)
    }));
  }
  return _results;
};
