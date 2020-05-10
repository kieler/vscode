/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2020 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This code is provided under the terms of the Eclipse Public License (EPL).
 */

/**
 * A deletion constraint data class.
 */
export class TreeDeletePositionConstraint {
    id: string
}

/**
 * A set position constraint data class.
 */
export class TreeSetPositionConstraint {
    id: string
    order: number
}
