/**
 * Copyright (c) Ladifire, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const flattenClasses = require("./classNames").flattenClasses;
const generateExpression = require("./generateExpression");

function getUses(varDec) {
  if (!varDec.isVariableDeclarator()) {
    throw varDec.buildCodeFrameError('Style has to be assigned to variable');
  }

  return varDec.scope.bindings[varDec.node.id.name].referencePaths;
}

function isDynamicKey(memberExpr) {
  const property = memberExpr.get('property');

  return memberExpr.node.computed && !property.isLiteral();
}

function getDynamicOrStaticKeys(memberExpr, allKeys) {
  // Don't remove any key when using dynamic access
  if (isDynamicKey(memberExpr)) return allKeys;

  return [memberExpr.node.property.name || memberExpr.node.property.value];
}

function replaceUseCalls(varDec, classes) {
  if (varDec.isMemberExpression()) {
    return getDynamicOrStaticKeys(varDec, Object.keys(classes));
  }

  if (varDec.get('id').isObjectPattern()) {
    const names = [];

    for (const prop of varDec.get('id.properties')) {
      if (prop.isRestElement()) {
        return Object.keys(classes);
      }
      names.push(prop.node.key.name);
    }

    return names;
  }

  const uses = getUses(varDec);
  const names = new Set();
  const flatClasses = flattenClasses(classes);

  for (const use of uses) {
    if (use.parentPath.isCallExpression() && use.parent.callee === use.node) {
      const args = normalizeArguments(use);
      args.forEach(arg => {
        if (typeof arg === 'string') names.add(arg);
        else names.add(arg.value);
      });
      const expr = generateExpression(args, flatClasses);
      use.parentPath.replaceWith(expr);
    } else if (use.parentPath.isMemberExpression()) {
      getDynamicOrStaticKeys(use.parentPath, Object.keys(classes))
        .forEach(key => names.add(key))
    } else if (use.parentPath.isSpreadElement()) {
      return Object.keys(classes);
    }
  }

  return Array.from(names);
}

module.exports = replaceUseCalls;