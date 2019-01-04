/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
import { Container, ContainerModule } from "inversify"
import { ConsoleLogger, LogLevel, SGraph,
        SGraphView, TYPES, boundsModule,
        buttonModule, configureModelElement, defaultModule, expandModule,
        exportModule, fadeModule, hoverModule, modelSourceModule, moveModule,
        openModule, overrideViewerOptions, selectModule, undoRedoModule,
        viewportModule } from 'sprotty/lib'
import { popupModelFactory } from "./popup"
import { KEdgeView,  KNodeView, KPortView, KLabelView} from "./views"
import { KNode, KPort, KLabel, KEdge } from "./kgraph-models"
import { KGraphModelFactory } from "./model-factory"
import { RequestTextBoundsCommand } from "./actions"
import { HiddenTextBoundsUpdater } from "./hidden-text-bounds-updater"

const kGraphDiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(TYPES.ILogger).to(ConsoleLogger).inSingletonScope()
    rebind(TYPES.LogLevel).toConstantValue(LogLevel.warn)
    rebind(TYPES.IModelFactory).to(KGraphModelFactory).inSingletonScope()
    bind(TYPES.PopupModelFactory).toConstantValue(popupModelFactory)
    const context = { bind, unbind, isBound, rebind };
    configureModelElement(context, 'graph', SGraph, SGraphView);
    configureModelElement(context, 'node', KNode, KNodeView)
    configureModelElement(context, 'edge', KEdge, KEdgeView)
    configureModelElement(context, 'port', KPort, KPortView)
    configureModelElement(context, 'label', KLabel, KLabelView)
})

const textBoundsModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(TYPES.ICommand).toConstructor(RequestTextBoundsCommand)
    bind(TYPES.HiddenVNodeDecorator).to(HiddenTextBoundsUpdater).inSingletonScope()
});

export default function createContainer(widgetId: string): Container {
    const container = new Container()
    container.load(defaultModule, selectModule, moveModule, boundsModule, undoRedoModule, viewportModule,
        hoverModule, fadeModule, exportModule, expandModule, openModule, buttonModule, modelSourceModule,
        kGraphDiagramModule, textBoundsModule)
    overrideViewerOptions(container, {
        needsClientLayout: false,
        needsServerLayout: true,
        baseDiv: widgetId
    })
    return container
}