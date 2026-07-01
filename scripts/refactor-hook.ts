import { Project, SyntaxKind } from "ts-morph";

const project = new Project();
const sourceFile = project.addSourceFileAtPath("src/hooks/useAdaptiveMultiStreamTransfer.ts");

// Remove React imports
const reactImport = sourceFile.getImportDeclaration(imp => imp.getModuleSpecifierValue() === 'react');
if (reactImport) {
    reactImport.remove();
}

// Add EventEmitter import
sourceFile.addImportDeclaration({
    namedImports: ["EventEmitter"],
    moduleSpecifier: "events"
});

// Find the useAdaptiveMultiStreamTransfer function
const hookDecl = sourceFile.getVariableDeclaration("useAdaptiveMultiStreamTransfer");
if (hookDecl) {
    hookDecl.rename("createTransferEngine");
    
    const initializer = hookDecl.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
    const body = initializer.getFirstChildByKind(SyntaxKind.Block);
    if (!body) throw new Error("No block body found");

    // Add emitter to the top of the body
    body.insertStatements(0, "const emitter = new EventEmitter();");

    // 1. Replace useRef & useCallback
    const callExprs = body.getDescendantsOfKind(SyntaxKind.CallExpression).reverse();
    for (const callExpr of callExprs) {
        const expr = callExpr.getExpression();
        if (expr.getText() === "useRef") {
            const args = callExpr.getArguments();
            const typeArgs = callExpr.getTypeArguments();
            const typeText = typeArgs.length > 0 ? typeArgs[0].getText() : "any";
            const argText = args.length > 0 ? args[0].getText() : "undefined";
            
            callExpr.replaceWithText(`{ current: ${argText} } as { current: ${typeText} }`);
        } else if (expr.getText() === "useCallback") {
            const args = callExpr.getArguments();
            if (args.length >= 2) {
                // remove the dependency array
                callExpr.replaceWithText(args[0].getText());
            }
        }
    }

    // 2. Replace useState
    const varDecls = body.getVariableDeclarations().reverse();
    for (const varDecl of varDecls) {
        const init = varDecl.getInitializer();
        if (init && init.getKind() === SyntaxKind.CallExpression) {
            const callExpr = init.asKindOrThrow(SyntaxKind.CallExpression);
            if (callExpr.getExpression().getText() === "useState") {
                const nameNode = varDecl.getNameNode();
                if (nameNode.getKind() === SyntaxKind.ArrayBindingPattern) {
                    const elements = nameNode.asKindOrThrow(SyntaxKind.ArrayBindingPattern).getElements();
                    if (elements.length === 2) {
                        const stateName = elements[0].getText();
                        const setterName = elements[1].getText();
                        const args = callExpr.getArguments();
                        const argText = args.length > 0 ? args[0].getText() : "undefined";
                        
                        const varStmt = varDecl.getVariableStatementOrThrow();
                        varStmt.replaceWithText(`let ${stateName} = ${argText};\n  const ${setterName} = (next: any) => { ${stateName} = typeof next === 'function' ? next(${stateName}) : next; emitter.emit('progress', ${stateName}); };`);
                    }
                }
            }
        }
    }

    // 3. Update the return statement to include emitter
    const returnStmt = body.getStatements().find(s => s.getKind() === SyntaxKind.ReturnStatement);
    if (returnStmt) {
        const retExpr = returnStmt.asKindOrThrow(SyntaxKind.ReturnStatement).getExpression();
        if (retExpr && retExpr.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const objLiteral = retExpr.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
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
