"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts_morph_1 = require("ts-morph");
var project = new ts_morph_1.Project();
var sourceFile = project.addSourceFileAtPath("src/hooks/useAdaptiveMultiStreamTransfer.ts");
// Remove React imports
var reactImport = sourceFile.getImportDeclaration(function (imp) { return imp.getModuleSpecifierValue() === 'react'; });
if (reactImport) {
    reactImport.remove();
}
// Add EventEmitter import
sourceFile.addImportDeclaration({
    namedImports: ["EventEmitter"],
    moduleSpecifier: "events"
});
// Find the useAdaptiveMultiStreamTransfer function
var hookDecl = sourceFile.getVariableDeclaration("useAdaptiveMultiStreamTransfer");
if (hookDecl) {
    hookDecl.rename("createTransferEngine");
    var initializer = hookDecl.getInitializerIfKindOrThrow(ts_morph_1.SyntaxKind.ArrowFunction);
    var body = initializer.getFirstChildByKind(ts_morph_1.SyntaxKind.Block);
    if (!body)
        throw new Error("No block body found");
    // Add emitter to the top of the body
    body.insertStatements(0, "const emitter = new EventEmitter();");
    // 1. Replace useRef & useCallback
    var callExprs = body.getDescendantsOfKind(ts_morph_1.SyntaxKind.CallExpression).reverse();
    for (var _i = 0, callExprs_1 = callExprs; _i < callExprs_1.length; _i++) {
        var callExpr = callExprs_1[_i];
        var expr = callExpr.getExpression();
        if (expr.getText() === "useRef") {
            var args = callExpr.getArguments();
            var typeArgs = callExpr.getTypeArguments();
            var typeText = typeArgs.length > 0 ? typeArgs[0].getText() : "any";
            var argText = args.length > 0 ? args[0].getText() : "undefined";
            callExpr.replaceWithText("{ current: ".concat(argText, " } as { current: ").concat(typeText, " }"));
        }
        else if (expr.getText() === "useCallback") {
            var args = callExpr.getArguments();
            if (args.length >= 2) {
                // remove the dependency array
                callExpr.replaceWithText(args[0].getText());
            }
        }
    }
    // 2. Replace useState
    var varDecls = body.getVariableDeclarations().reverse();
    for (var _a = 0, varDecls_1 = varDecls; _a < varDecls_1.length; _a++) {
        var varDecl = varDecls_1[_a];
        var init = varDecl.getInitializer();
        if (init && init.getKind() === ts_morph_1.SyntaxKind.CallExpression) {
            var callExpr = init.asKindOrThrow(ts_morph_1.SyntaxKind.CallExpression);
            if (callExpr.getExpression().getText() === "useState") {
                var nameNode = varDecl.getNameNode();
                if (nameNode.getKind() === ts_morph_1.SyntaxKind.ArrayBindingPattern) {
                    var elements = nameNode.asKindOrThrow(ts_morph_1.SyntaxKind.ArrayBindingPattern).getElements();
                    if (elements.length === 2) {
                        var stateName = elements[0].getText();
                        var setterName = elements[1].getText();
                        var args = callExpr.getArguments();
                        var argText = args.length > 0 ? args[0].getText() : "undefined";
                        var varStmt = varDecl.getVariableStatementOrThrow();
                        varStmt.replaceWithText("let ".concat(stateName, " = ").concat(argText, ";\n  const ").concat(setterName, " = (next: any) => { ").concat(stateName, " = typeof next === 'function' ? next(").concat(stateName, ") : next; emitter.emit('progress', ").concat(stateName, "); };"));
                    }
                }
            }
        }
    }
    // 3. Update the return statement to include emitter
    var returnStmt = body.getStatements().find(function (s) { return s.getKind() === ts_morph_1.SyntaxKind.ReturnStatement; });
    if (returnStmt) {
        var retExpr = returnStmt.asKindOrThrow(ts_morph_1.SyntaxKind.ReturnStatement).getExpression();
        if (retExpr && retExpr.getKind() === ts_morph_1.SyntaxKind.ObjectLiteralExpression) {
            var objLiteral = retExpr.asKindOrThrow(ts_morph_1.SyntaxKind.ObjectLiteralExpression);
            objLiteral.addPropertyAssignment({
                name: "on",
                initializer: "emitter.on.bind(emitter)"
            });
            objLiteral.addPropertyAssignment({
                name: "off",
                initializer: "emitter.off.bind(emitter)"
            });
        }
    }
}
sourceFile.saveSync();
