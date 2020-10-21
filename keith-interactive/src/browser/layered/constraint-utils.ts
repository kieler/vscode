/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2019, 2020 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This code is provided under the terms of the Eclipse Public License (EPL).
 */

import { Action, SModelElement } from 'sprotty';
import { RefreshDiagramAction } from '../actions';
import { Direction, KEdge, KNode } from '../constraint-classes';
import { filterKNodes } from '../helper-methods';
import { SetLayerConstraintAction, SetPositionConstraintAction, SetStaticConstraintAction } from './actions';
import { Layer } from './constraint-types';
import { getChain } from './relativeConstraint-utils';

/**
 * Offset for placement on below or above the first/last node in the layer.
 */
export const PLACEMENT_TOP_BOTTOM_OFFSET = 20;
/**
 * Layer padding for one layer case.
 */
export const ONE_LAYER_PADDING = 10;

/**
 * Calculates the layer the node is in.
 * @param node Node which layer should be calculated.
 * @param nodes All nodes in the same hierarchical level as the node which layer should be calculated.
 * @param layers All layers at the hierarchical level.
 */
export function getLayerOfNode(node: KNode, nodes: KNode[], layers: Layer[], direction: Direction): number {
    let coordinateInLayoutDirection = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.LEFT)
        ? node.position.x + node.size.width / 2 : node.position.y + node.size.height / 2

    // check for all layers if the node is in the layer
    for (let layer of layers) {
        if (coordinateInLayoutDirection < layer.end &&
            (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.DOWN) ||
        coordinateInLayoutDirection > layer.end && (direction === Direction.LEFT || direction === Direction.UP)) {
            return layer.id
        }
    }

    // if the node is the only one in the last layer it can not be in a new last layer
    let lastLNodes = getNodesOfLayer(layers[layers.length - 1].id, nodes)
    if (lastLNodes.length === 1 && lastLNodes[0].selected) {
        // node is in last layer
        return layers[layers.length - 1].id
    }

    // node is in a new last layer
    return layers[layers.length - 1].id + 1
}

/**
 * Adjusts the layer constraint value for a node in case that the target layer's id was boosted by an user defined constraint.
 * @param node the node that was moved
 * @param nodes all nodes
 * @param layerCandidate the current candidate value for the new layer constraint
 */
export function getActualLayer(node: KNode, nodes: KNode[], layerCandidate: number) {

    // Examine all nodes that have a layer Id left or equal to the layerCandidate and that have a layerCons > their layerId
    let layerConstraintLeftOfCandidate = nodes.filter(n => n.properties.layerId <= layerCandidate && n.properties.layerConstraint > n.properties.layerId)

    // In case that there are no such nodes return the layerCandidate
    if (layerConstraintLeftOfCandidate.length === 0) {
        return layerCandidate
    }

    // Search the highest layer constraint among those nodes
    // You can't just look to the left layer or the layer left of the next layer since their could have been an arbitrary numbers
    // of shifts
    let nodeWithMaxCons = null
    let maxCons = -1
    for (let n of layerConstraintLeftOfCandidate) {
        const layerConstraint = n.properties.layerConstraint
        if (layerConstraint > maxCons) {
            nodeWithMaxCons = n
            maxCons = layerConstraint
        }
    }

    if (nodeWithMaxCons !== null) {
        let idDiff = layerCandidate - nodeWithMaxCons.properties.layerId
        return maxCons + idDiff
    }

    return layerCandidate
}

/**
 * Adjusts the target index of a node in the case that the node above it has a position constraint > count of nodes in the layer.
 * @param targetIndex the current candidate target index
 * @param alreadyInLayer signals whether the node already was in the layer before it was moved.
 * @param layerNodes all nodes of the target layer
 */
export function getActualTargetIndex(targetIndex: number, alreadyInLayer: boolean, layerNodes: KNode[]) {
    let localTargetIndex = targetIndex
    if (localTargetIndex > 0) {
        // Check whether there is an user defined pos constraint on the upper neighbour that is higher
        // than its position ID
        let upperIndex = localTargetIndex - 1
        let upperNeighbor = layerNodes[upperIndex]
        let posConsOfUpper = upperNeighbor.properties.positionConstraint
        if (posConsOfUpper > upperIndex) {
            if (alreadyInLayer && upperNeighbor.properties.positionId === localTargetIndex) {
                localTargetIndex = posConsOfUpper
            } else {
                localTargetIndex = posConsOfUpper + 1
            }
        }
    }
    return localTargetIndex
}

/**
 * Calculates the layers in a graph based on the layer IDs and positions of the nodes.
 * @param nodes All nodes of the graph which layers should be calculated.
 */
export function getLayers(nodes: KNode[], direction: Direction): Layer[] {
    // All nodes within one hierarchy level have the same direction
    nodes.sort((a, b) => a.properties.layerId - b.properties.layerId)
    let layers = []
    let layer = 0
    // Begin coordinate of layer, depending of on the layout direction this might be a x or y coordinate
    let beginCoordinate = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.DOWN) ? Number.MAX_VALUE : Number.MIN_VALUE
    // End coordinate of layer, depending of on the layout direction this might be a x or y coordinate
    let endCoordinate = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.DOWN) ? Number.MIN_VALUE : Number.MAX_VALUE
    let topBorder = Number.MAX_VALUE // naming fits to the RIGHT direction (1)
    let bottomBorder = Number.MIN_VALUE
    // calculate bounds of the layers
    for (let node of nodes) {
        if (node.properties.layerId !== layer) {
            // node is in the next layer
            layers[layers.length] = new Layer(layer, beginCoordinate, endCoordinate, beginCoordinate + (endCoordinate - beginCoordinate) / 2, direction)
            beginCoordinate = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.DOWN) ? Number.MAX_VALUE : Number.MIN_VALUE
            endCoordinate = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.DOWN) ? Number.MIN_VALUE : Number.MAX_VALUE
            layer = node.properties.layerId
        }

        // coordinates of the current node for case 1
        let currentBegin = 0
        let currentEnd = 0
        let currentTopBorder = 0
        let currentBottomBorder = 0
        switch (direction) {
            case Direction.UNDEFINED: case Direction.RIGHT: {
                currentBegin = node.shadow ? node.shadowX : node.position.x
                currentEnd = currentBegin + node.size.width
                currentTopBorder = node.shadow ? node.shadowY : node.position.y
                currentBottomBorder = currentTopBorder + node.size.height
                break;
            }
            case Direction.LEFT: {
                currentEnd = node.shadow ? node.shadowX : node.position.x
                currentBegin = currentEnd + node.size.width
                currentTopBorder = node.shadow ? node.shadowY : node.position.y
                currentBottomBorder = currentTopBorder + node.size.height
                break;
            }
            case Direction.DOWN: {
                currentBegin = node.shadow ? node.shadowY : node.position.y
                currentEnd = currentBegin + node.size.height
                currentTopBorder = node.shadow ? node.shadowX : node.position.x
                currentBottomBorder = currentTopBorder + node.size.width
                break;
            }
            case Direction.UP: {
                currentEnd = node.shadow ? node.shadowY : node.position.y
                currentBegin = currentEnd + node.size.height
                currentTopBorder = node.shadow ? node.shadowX : node.position.x
                currentBottomBorder = currentTopBorder + node.size.width
                break;
            }
        }

        // update coordinates of the current layer
        beginCoordinate = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.DOWN) ?
            Math.min(currentBegin, beginCoordinate) : Math.max(currentBegin, beginCoordinate)
        endCoordinate = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.DOWN) ?
            Math.max(currentEnd, endCoordinate) : Math.min(currentEnd, endCoordinate)
        topBorder = Math.min(currentTopBorder, topBorder)
        bottomBorder = Math.max(currentBottomBorder, bottomBorder)
    }
    // add last layer
    layers[layers.length] = new Layer(layer, beginCoordinate, endCoordinate, beginCoordinate + ((endCoordinate - beginCoordinate) / 2), direction)
    // offset above & below the layers
    topBorder = topBorder - PLACEMENT_TOP_BOTTOM_OFFSET
    bottomBorder = bottomBorder + PLACEMENT_TOP_BOTTOM_OFFSET
    // update left and right bounds of the layers and set y bounds
    for (let i = 0; i < layers.length - 1; i++) {
        // calculate the mid between two layers
        let currentLayer = layers[i]
        let precedingLayer = layers[i + 1]
        let mid = currentLayer.end + (precedingLayer.begin - currentLayer.end) / 2
        // set right bound of the first and left bound of the second layer to the calculated mid
        currentLayer.end = mid
        precedingLayer.begin = mid
        // set y coordinates
        currentLayer.topBorder = topBorder
        currentLayer.bottomBorder = bottomBorder
    }

    // special case: only one layer exists
    if (layers.length === 1) {
        let firstLayer = layers[0]
        // add padding
        switch (direction) {
            case Direction.UNDEFINED: case Direction.RIGHT: {
                firstLayer.begin = firstLayer.begin - ONE_LAYER_PADDING
                firstLayer.end = firstLayer.end + ONE_LAYER_PADDING
                firstLayer.topBorder = topBorder
                firstLayer.bottomBorder = bottomBorder
                break;
            }
            case Direction.LEFT: {
                firstLayer.begin = firstLayer.begin + ONE_LAYER_PADDING
                firstLayer.end = firstLayer.end - ONE_LAYER_PADDING
                firstLayer.topBorder = topBorder
                firstLayer.bottomBorder = bottomBorder
                break;
            }
            case Direction.DOWN: {
                firstLayer.begin = firstLayer.begin - ONE_LAYER_PADDING
                firstLayer.end = firstLayer.end + ONE_LAYER_PADDING
                firstLayer.topBorder = topBorder
                firstLayer.bottomBorder = bottomBorder
                break;
            }
            case Direction.UP: {
                firstLayer.begin = firstLayer.begin + ONE_LAYER_PADDING
                firstLayer.end = firstLayer.end - ONE_LAYER_PADDING
                firstLayer.topBorder = topBorder
                firstLayer.bottomBorder = bottomBorder
                break;
            }
        }
    } else {
        // update left bound of the first layer
        // add padding
        let firstLayer = layers[0]
        firstLayer.begin = firstLayer.mid - (firstLayer.end - firstLayer.mid)

        // update bounds of the last layer
        // left bound of the layer is the right bound of the layer left of it
        let lastLayer = layers[layers.length - 1]
        lastLayer.begin = layers[layers.length - 2].end
        // distance from mid of the last layer to the right bound should be the same as to the left bound
        let distance = lastLayer.mid - lastLayer.begin
        lastLayer.end = lastLayer.mid + distance
        // set y coordinates
        lastLayer.topBorder = topBorder
        lastLayer.bottomBorder = bottomBorder
    }
    return layers
}

/**
 * Calculates the nodes that are in the given layer based on the layer IDs of the nodes.
 * @param layer The layer which containing nodes should be calculated.
 * @param nodes All nodes the graph contains.
 */
export function getNodesOfLayer(layer: number, nodes: KNode[]): KNode[] {
    let nodesOfLayer: KNode[] = []
    for (let node of nodes) {
        if (node.properties.layerId === layer) {
            nodesOfLayer[nodesOfLayer.length] = node
        }
    }
    return nodesOfLayer
}

/**
 * Calculates the position of the target node in relation to the nodes in the layer based on their y coordinates.
 * @param nodes Nodes of the layer the target is in.
 * @param target Node which position should be calculated.
 */
export function getPositionInLayer(nodes: KNode[], target: KNode, direction: Direction): number {
    // Sort the layer array by coordinates of the nodes.
    switch (direction) {
        case Direction.UNDEFINED:
        case Direction.LEFT:
        case Direction.RIGHT: {
            nodes.sort((a, b) => a.position.y - b.position.y)
            break;
        }
        case Direction.UP:
        case Direction.DOWN: {
            nodes.sort((a, b) => a.position.x - b.position.x)
            break;
        }
    }

    // Find the position of the target
    if (nodes.indexOf(target) !== -1) {
        // target is already in the list
        return nodes.indexOf(target)
    }

    switch (direction) {
        case Direction.UNDEFINED:
        case Direction.LEFT:
        case Direction.RIGHT: {
            for (let i = 0; i < nodes.length; i++) {
                if (target.position.y < nodes[i].position.y) {
                    return i
                }
            }
            break;
        }
        case Direction.UP:
        case Direction.DOWN: {
            for (let i = 0; i < nodes.length; i++) {
                if (target.position.x < nodes[i].position.x) {
                    return i
                }
            }
            break;
        }
    }

    return nodes.length
}

/**
 * Determines whether the layer is forbidden for the given node.
 * The layer is forbidden if another node is in the layer that
 * is connected to the given node by an edge and has a layer constraint.
 * @param node The KNode.
 * @param layer The number indicating the layer.
 */
export function isLayerForbidden(node: KNode, layer: number): boolean {
    let layerNodes = getNodesOfLayer(node.properties.layerId, filterKNodes(node.parent.children as KNode []))
    let chainNodes = getChain(node, layerNodes)
    // collect the connected nodes
    let connectedNodes: KNode[] = []
    for (let n of chainNodes) {
        let edges = n.outgoingEdges as any as KEdge[]
        for (let edge of edges) {
            connectedNodes[connectedNodes.length] = edge.target as KNode
        }
        edges = n.incomingEdges as any as KEdge[]
        for (let edge of edges) {
            connectedNodes[connectedNodes.length] = edge.source as KNode
        }
    }

    // check the connected nodes for layer constraints
    for (let node of connectedNodes) {
        if (node.properties.layerId === layer && node.properties.layerConstraint !== -1) {
            // layer is forbidden for the given node
            return true
        }
    }

    // layer is valid for the given node
    return false
}

/**
 * Determines whether only the layer constraint should be set.
 * @param node The node that is moved.
 * @param layers The layers in the graph.
 */
export function shouldOnlyLCBeSet(node: KNode, layers: Layer[], direction: Direction): boolean {
    let coordinateToCheck = (direction === Direction.UNDEFINED || direction === Direction.RIGHT || direction === Direction.LEFT) ?
        node.position.y : node.position.x
    if (layers.length !== 0) {
        let layerTop = layers[0].topBorder
        let layerBot = layers[0].bottomBorder
        // if the node is below or above the layer only the layer constraint should be set
        return coordinateToCheck < layerTop || coordinateToCheck > layerBot
    }
    return false
}
/**
 * Sets properties of the target accordingly to the position the target is moved to
 * @param target SModelElement that is moved
 */
export function setProperty(nodes: KNode[], layers: Layer[], target: SModelElement): Action {
    const targetNode: KNode = target as KNode
    const direction = targetNode.direction
    // calculate layer and position the target has in the graph at the new position
    const layerOfTarget = getLayerOfNode(targetNode, nodes, layers, direction)
    const nodesOfLayer = getNodesOfLayer(layerOfTarget, nodes)
    const positionOfTarget = getPositionInLayer(nodesOfLayer, targetNode, direction)
    const newPositionCons = getActualTargetIndex(positionOfTarget, nodesOfLayer.indexOf(targetNode) !== -1, nodesOfLayer)
    const newLayerCons = getActualLayer(targetNode, nodes, layerOfTarget)
    const forbidden = isLayerForbidden(targetNode, newLayerCons)

    if (forbidden) {
        // If layer is forbidden just refresh
        return new RefreshDiagramAction()
    } else if (targetNode.properties.layerId !== layerOfTarget) {
        // layer constraint should only be set if the layer index changed
        if (shouldOnlyLCBeSet(targetNode, layers, direction)) {
            // only the layer constraint should be set
            return new SetLayerConstraintAction({
                id: targetNode.id,
                layer: layerOfTarget,
                layerCons: newLayerCons
            })
        } else {
            // If layer and position constraint should be set - send them both in one StaticConstraint
            return new SetStaticConstraintAction({
                id: targetNode.id,
                layer: layerOfTarget,
                layerCons: newLayerCons,
                position: positionOfTarget,
                posCons: newPositionCons
            })
        }
    } else {

        // position constraint should only be set if the position of the node changed
        if (targetNode.properties.positionId !== positionOfTarget) {
            // set the position Constraint
            return new SetPositionConstraintAction({
                id: targetNode.id,
                position: positionOfTarget,
                posCons: newPositionCons
            })
        }
    }
    // If the node was moved without setting a constraint - let it snap back
    return new RefreshDiagramAction()
}