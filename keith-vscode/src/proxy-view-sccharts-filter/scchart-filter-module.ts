/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2022 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This code is provided under the terms of the Eclipse Public License (EPL).
 */

import { ContainerModule } from 'inversify'
import { TYPES } from 'sprotty'
import { SCChartProxyFilterHandler } from './scchart-filters'

export const sCChartFilterModule = new ContainerModule((bind) => {
    // Bind the action initializer
    bind(SCChartProxyFilterHandler).toSelf().inSingletonScope()
    bind(TYPES.IActionHandlerInitializer).toService(SCChartProxyFilterHandler)
})
