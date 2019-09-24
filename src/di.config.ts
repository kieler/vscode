/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2019 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This code is provided under the terms of the Eclipse Public License (EPL).
 */
import { Container, ContainerModule } from 'inversify';
import {
    configureModelElement, ConsoleLogger, defaultModule, exportModule, LogLevel, modelSourceModule, moveModule, overrideViewerOptions, selectModule, SGraph, SGraphFactory, TYPES,
    updateModule, viewportModule
} from 'sprotty/lib';
import actionModule from './actions/actions-module';
import { SKEdge, SKLabel, SKNode, SKPort } from './skgraph-models';
import textBoundsModule from './textbounds/textbounds-module';
import { KEdgeView, KLabelView, KNodeView, KPortView, SKGraphView } from './views';

/**
 * Dependency injection module that adds functionality for diagrams and configures the views for KGraphElements.
 */
const kGraphDiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(TYPES.ILogger).to(ConsoleLogger).inSingletonScope()
    rebind(TYPES.LogLevel).toConstantValue(LogLevel.warn)
    rebind(TYPES.IModelFactory).to(SGraphFactory).inSingletonScope()
    rebind(TYPES.CommandStackOptions).toConstantValue({
        // Override the default animation speed to be 500 ms, as the default value is too quick.
        defaultDuration: 500,
        undoHistoryLimit: 50
    });
    const context = { bind, unbind, isBound, rebind };
    configureModelElement(context, 'graph', SGraph, SKGraphView);
    configureModelElement(context, 'node', SKNode, KNodeView)
    configureModelElement(context, 'edge', SKEdge, KEdgeView)
    configureModelElement(context, 'port', SKPort, KPortView)
    configureModelElement(context, 'label', SKLabel, KLabelView)
})

/**
 * Dependency injection container that bundles all needed sprotty and custom modules to allow KGraphs to be drawn with sprotty.
 */
export default function createContainer(widgetId: string): Container {
    const container = new Container()
    container.load(defaultModule, selectModule, moveModule, viewportModule, exportModule, modelSourceModule, updateModule, kGraphDiagramModule, textBoundsModule, actionModule)
    overrideViewerOptions(container, {
        needsClientLayout: false,
        needsServerLayout: true,
        baseDiv: widgetId,
        hiddenDiv: widgetId + '_hidden'
    })
    return container
}