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
/** @jsx svg */
import { SVGAttributes } from 'react';
import { svg } from 'snabbdom-jsx';
import { VNode } from 'snabbdom/vnode';
import {
    Arc, isRendering, KArc, KChildArea, KContainerRendering, KEdge, KForeground, KGraphData, KGraphElement, KLabel, KPolyline, KRendering, KRenderingLibrary, KRenderingRef,
    KRoundedBendsPolyline, KRoundedRectangle, KText, K_ARC, K_CHILD_AREA, K_CONTAINER_RENDERING, K_CUSTOM_RENDERING, K_ELLIPSE, K_IMAGE, K_POLYGON, K_POLYLINE, K_RECTANGLE,
    K_RENDERING_LIBRARY, K_RENDERING_REF, K_ROUNDED_BENDS_POLYLINE, K_ROUNDED_RECTANGLE, K_SPLINE, K_TEXT
} from './kgraph-models';
import { findBoundsAndTransformationData, findTextBoundsAndTransformationData, getPoints, KGraphRenderingContext } from './views-common';
import { getKStyles, getSvgColorStyle, getSvgColorStyles, getSvgLineStyles, getSvgShadowStyles, getSvgTextStyles, isInvisible } from './views-styles';

// ----------------------------- Functions for rendering different KRendering as VNodes in svg --------------------------------------------

/**
 * Translates a KChildArea rendering into an SVG rendering.
 * @param rendering The rendering.
 * @param parent The parent element.
 * @param context The rendering context for this element.
 */
export function renderChildArea(rendering: KChildArea, parent: KGraphElement, context: KGraphRenderingContext) {
    if (parent.areChildrenRendered) {
        console.error('This element contains multiple child areas, skipping this one.')
        return <g />
    }
    // remember, that this parent's children are now already rendered
    parent.areChildrenRendered = true

    // Extract the styles of the rendering into a more presentable object.
    const styles = getKStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)

    // Determine the bounds of the rendering first and where it has to be placed.
    const boundsAndTransformation = findBoundsAndTransformationData(rendering, styles.kRotation, parent, context)
    if (boundsAndTransformation === undefined) {
        // If no bounds are found, the rendering can not be drawn.
        return renderError(rendering)
    }

    const gAttrs: SVGAttributes<SVGGElement> = {
        ...(boundsAndTransformation.transformation !== undefined ? { transform: boundsAndTransformation.transformation } : {})
    }

    let element = <g id={rendering.id} {...gAttrs}>
        {context.renderChildren(parent)}
    </g>

    return element
}

/**
 * Translates a rectangular rendering into an SVG rendering.
 * This includes KEllipse, KRectangle and KRoundedRectangle.
 * @param rendering The rendering.
 * @param parent The parent element.
 * @param context The rendering context for this element.
 */
export function renderRectangularShape(rendering: KContainerRendering, parent: KGraphElement, context: KGraphRenderingContext): VNode {
    // Extract the styles of the rendering into a more presentable object.
    const styles = getKStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)

    // Determine the bounds of the rendering first and where it has to be placed.
    const boundsAndTransformation = findBoundsAndTransformationData(rendering, styles.kRotation, parent, context)
    if (boundsAndTransformation === undefined) {
        // If no bounds are found, the rendering can not be drawn.
        return renderError(rendering)
    }

    const gAttrs: SVGAttributes<SVGGElement> = {
        ...(boundsAndTransformation.transformation !== undefined ? { transform: boundsAndTransformation.transformation } : {})
    }

    // Check the invisibility first. If this rendering is supposed to be invisible, do not render it,
    // only render its children transformed by the transformation already calculated.
    if (isInvisible(styles)) {
        return <g {...gAttrs}>
            {renderChildRenderings(rendering, parent, context)}
        </g>
    }

    // Default case. Calculate all svg objects and attributes needed to build this rendering from the styles and the rendering.
    const colorStyles = getSvgColorStyles(styles, context)
    const shadowStyles = getSvgShadowStyles(styles, context)
    const lineStyles = getSvgLineStyles(styles)

    // Create the svg element for this rendering.
    let element: VNode
    switch (rendering.type) {
        case K_ARC: {
            const kArcRendering = rendering as KArc

            let sweepFlag = 0
            let angle = kArcRendering.arcAngle
            // For a negative angle, rotate the other way around.
            if (angle < 0) {
                angle = -angle
                sweepFlag = 1
            }
            // If the angle is bigger than or equal to 360 degrees, use the same rendering as a KEllipse via fallthrough to that rendering instead.
            if (angle < 360) {
                // Calculation to get the start and endpoint of the arc from the angles given.
                // Reduce the width and height by half the linewidth on both sides, so the ellipse really stays within the given bounds.
                const width = boundsAndTransformation.bounds.width - styles.kLineWidth.lineWidth
                const height = boundsAndTransformation.bounds.height - styles.kLineWidth.lineWidth
                const rX = width / 2
                const rY = height / 2
                const midX = rX + styles.kLineWidth.lineWidth / 2
                const midY = rY + styles.kLineWidth.lineWidth / 2
                const startX = midX + rX * Math.cos(kArcRendering.startAngle * Math.PI / 180)
                const startY = midY - rY * Math.sin(kArcRendering.startAngle * Math.PI / 180)
                const endAngle = kArcRendering.startAngle + kArcRendering.arcAngle
                const endX = midX + rX * Math.cos(endAngle * Math.PI / 180)
                const endY = midY - rY * Math.sin(endAngle * Math.PI / 180)


                // If the angle is bigger or equal 180 degrees, use the large arc as of the w3c path specification
                // https://www.w3.org/TR/SVG/paths.html#PathDataEllipticalArcCommands
                const largeArcFlag = angle >= 180 ? 1 : 0
                // Rotation is not handled via KArcs but via KRotations, so leave this value as 0.
                const rotate = 0

                // The main arc.
                let d = `M${startX},${startY}A${rX},${rY},${rotate},${largeArcFlag},${sweepFlag},${endX},${endY}`
                switch (kArcRendering.arcType) {
                    case Arc.OPEN: {
                        // Open chords do not have any additional lines.
                        break
                    }
                    case Arc.CHORD: {
                        // Add a straight line from the end to the beginning point.
                        d += `L${startX},${startY}`
                        break
                    }
                    case Arc.PIE: {
                        // Add a straight line from the end to the center and then back to the beginning point.
                        d += `L${midX},${midY}L${startX},${startY}`
                        break
                    }
                }

                element = <g id={rendering.id} {...gAttrs}>
                    <path
                        d={d}
                        style={{
                            'stroke-linecap': lineStyles.lineCap,
                            'stroke-linejoin': lineStyles.lineJoin,
                            'stroke-width': lineStyles.lineWidth,
                            'stroke-dasharray': lineStyles.dashArray,
                            'stroke-miterlimit': lineStyles.miterLimit
                        } as React.CSSProperties}
                        stroke={colorStyles.foreground}
                        fill={colorStyles.background}
                        filter={shadowStyles}
                    />
                    {renderChildRenderings(rendering, parent, context)}
                </g>
                break
            } else {
                // Fallthrough to KEllipse case.
            }
        }
        case K_ELLIPSE: {
            element = <g id={rendering.id} {...gAttrs}>
                <ellipse
                    cx={boundsAndTransformation.bounds.width / 2}
                    cy={boundsAndTransformation.bounds.height / 2}
                    rx={boundsAndTransformation.bounds.width / 2}
                    ry={boundsAndTransformation.bounds.height / 2}
                    style={{
                        'stroke-linecap': lineStyles.lineCap,
                        'stroke-linejoin': lineStyles.lineJoin,
                        'stroke-width': lineStyles.lineWidth,
                        'stroke-dasharray': lineStyles.dashArray,
                        'stroke-miterlimit': lineStyles.miterLimit
                    } as React.CSSProperties}
                    stroke={colorStyles.foreground}
                    fill={colorStyles.background}
                    filter={shadowStyles}
                />
                {renderChildRenderings(rendering, parent, context)}
            </g>
            break
        }
        case K_RECTANGLE:
        case K_ROUNDED_RECTANGLE: {
            // like this the rx and ry will be undefined during the rendering of a roundedRectangle and therefore those fields will be left out.
            // Rounded rectangles work in svg just like regular rectangles just with those two added variables, so this call will result in a regular rectangle.

            // Rendering-specific attributes
            const rx = (rendering as KRoundedRectangle).cornerWidth
            const ry = (rendering as KRoundedRectangle).cornerHeight

            element = <g id={rendering.id} {...gAttrs}>
                <rect
                    width={boundsAndTransformation.bounds.width}
                    height={boundsAndTransformation.bounds.height}
                    {...(rx ? { rx: rx } : {})}
                    {...(ry ? { ry: ry } : {})}
                    style={{
                        'stroke-linecap': lineStyles.lineCap,
                        'stroke-linejoin': lineStyles.lineJoin,
                        'stroke-width': lineStyles.lineWidth,
                        'stroke-dasharray': lineStyles.dashArray,
                        'stroke-miterlimit': lineStyles.miterLimit
                    } as React.CSSProperties}
                    stroke={colorStyles.foreground}
                    fill={colorStyles.background}
                    filter={shadowStyles}
                />
                {renderChildRenderings(rendering, parent, context)}
            </g>
            break
        }
        default: {
            // This case can never happen. If it still does, happy debugging!
            throw new Error('Rendering is neither an KEllipse, nor a KRectangle or KRoundedRectangle!')
        }
    }

    return element
}

/**
 * Translates a line rendering into an SVG rendering.
 * This includes all subclasses of and the KPolyline rendering itself.
 * @param rendering The rendering.
 * @param parent The parent element.
 * @param context The rendering context for this element.
 */
export function renderLine(rendering: KPolyline, parent: KGraphElement | KEdge, context: KGraphRenderingContext): VNode {
    // TODO: implement junction point rendering

    // Extract the styles of the rendering into a more presentable object.
    const styles = getKStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)

    // Determine the bounds of the rendering first and where it has to be placed.
    // TODO: KPolylines are a special case of container renderings: their bounds should not be given down to their child renderings.
    const boundsAndTransformation = findBoundsAndTransformationData(rendering, styles.kRotation, parent, context, true)
    if (boundsAndTransformation === undefined) {
        // If no bounds are found, the rendering can not be drawn.
        return renderError(rendering)
    }

    const gAttrs: SVGAttributes<SVGGElement> = {
        ...(boundsAndTransformation.transformation !== undefined ? { transform: boundsAndTransformation.transformation } : {})
    }

    // Check the invisibility first. If this rendering is supposed to be invisible, do not render it,
    // only render its children transformed by the transformation already calculated.
    if (isInvisible(styles)) {
        return <g {...gAttrs}>
            {renderChildRenderings(rendering, parent, context)}
        </g>
    }

    // Default case. Calculate all svg objects and attributes needed to build this rendering from the styles and the rendering.
    const colorStyles = getSvgColorStyles(styles, context)
    const shadowStyles = getSvgShadowStyles(styles, context)
    const lineStyles = getSvgLineStyles(styles)

    const points = getPoints(parent, rendering, boundsAndTransformation)
    if (points.length === 0) {
        return <g>
            {renderChildRenderings(rendering, parent, context)}
        </g>
    }

    // now define the line's path.
    let path = ''
    switch (rendering.type) {
        case K_SPLINE: {
            path += `M${points[0].x},${points[0].y}`
            for (let i = 1; i < points.length; i = i + 3) {
                let remainingPoints = points.length - i
                if (remainingPoints === 1) {
                    // if one routing point is left, draw a straight line to there.
                    path += `L${points[i].x},${points[i].y}`
                } else if (remainingPoints === 2) {
                    // if two routing points are left, draw a quadratic bezier curve with those two points.
                    path += `Q${points[i].x},${points[i].y} ${points[i + 1].x},${points[i + 1].y}`
                } else {
                    // if three or more routing points are left, draw a cubic bezier curve with those points.
                    path += `C${points[i].x},${points[i].y} `
                        + `${points[i + 1].x},${points[i + 1].y} `
                        + `${points[i + 2].x},${points[i + 2].y}`
                }
            }
            break
        }
        case K_POLYLINE: // Fall through to next case. KPolylines are just KPolygons without the closing end.
        case K_POLYGON: {
            path += `M${points[0].x},${points[0].y}`
            for (let i = 1; i < points.length; i++) {
                path += `L${points[i].x},${points[i].y}`
            }
            if (rendering.type === K_POLYGON) {
                path += 'Z'
            }
            break
        }
        case K_ROUNDED_BENDS_POLYLINE: {
            // Rendering-specific attributes
            const bendRadius = (rendering as KRoundedBendsPolyline).bendRadius

            // now define the rounded polyline's path.
            path += `M${points[0].x},${points[0].y}`
            for (let i = 1; i < points.length - 1; i++) {
                const p0 = points[i - 1]
                const p = points[i]
                const p1 = points[i + 1]
                // last point
                const x0 = p0.x
                const y0 = p0.y
                // current point where a bend should be rendered
                const xp = p.x
                const yp = p.y
                // next point
                const x1 = p1.x
                const y1 = p1.y
                // distance between the last point and the current point
                const dist0 = Math.sqrt((x0 - xp) * (x0 - xp) + (y0 - yp) * (y0 - yp))
                // distance between the current point and the next point
                const dist1 = Math.sqrt((x1 - xp) * (x1 - xp) + (y1 - yp) * (y1 - yp))
                // If the previous / next point is too close, use a smaller bend radius
                const usedBendRadius = Math.min(bendRadius, dist0 / 2, dist1 / 2)
                // start and end points of the bend
                let xs, ys, xe, ye
                if (usedBendRadius === 0) {
                    // Avoid division by zero if two points are identical.
                    xs = xp
                    ys = yp
                    xe = xp
                    ye = yp
                } else {
                    xs = xp + (usedBendRadius * (x0 - xp)) / dist0
                    ys = yp + (usedBendRadius * (y0 - yp)) / dist0
                    xe = xp + (usedBendRadius * (x1 - xp)) / dist1
                    ye = yp + (usedBendRadius * (y1 - yp)) / dist1
                }
                // draw a line to the start of the bend point (from the last end of its bend)
                // and then draw the bend with the control points of the point itself and the bend end point.
                path += `L${xs},${ys}Q${xp},${yp} ${xe},${ye}`
            }
            if (points.length > 1) {
                let lastPoint = points[points.length - 1]
                path += `L${lastPoint.x},${lastPoint.y}`
            }
            break
        }
    }

    // Create the svg element for this rendering.
    let element = <g id={rendering.id} {...gAttrs}>
        <path
            d={path}
            style={{
                'stroke-linecap': lineStyles.lineCap,
                'stroke-linejoin': lineStyles.lineJoin,
                'stroke-width': lineStyles.lineWidth,
                'stroke-dasharray': lineStyles.dashArray,
                'stroke-miterlimit': lineStyles.miterLimit
            } as React.CSSProperties}
            stroke={colorStyles.foreground}
            fill={colorStyles.background}
            filter={shadowStyles}
        />
        {renderChildRenderings(rendering, parent, context)}
    </g>
    return element
}

/**
 * Translates a text rendering into an SVG text rendering.
 * @param rendering The rendering.
 * @param parent The parent element.
 * @param context The rendering context for this element.
 */
export function renderKText(rendering: KText, parent: KGraphElement | KLabel, context: KGraphRenderingContext): VNode {
    // Find the text to write first.
    let text = undefined
    // KText elements as renderings of labels have their text in the KLabel, not the KText
    if ('text' in parent) { // if parent is KLabel
        text = parent.text
    } else {
        text = rendering.text
    }
    // If no text can be found, return here.
    if (text === undefined) return <g />

    // The text split into an array for each individual line
    let lines = text.split('\n')

    // Extract the styles of the rendering into a more presentable object.
    const styles = getKStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)

    // Determine the bounds of the rendering first and where it has to be placed.
    const boundsAndTransformation = findTextBoundsAndTransformationData(rendering, styles, parent, context, lines.length)
    if (boundsAndTransformation === undefined) {
        // If no bounds are found, the rendering can not be drawn.
        return renderError(rendering)
    }

    const gAttrs: SVGAttributes<SVGGElement> = {
        ...(boundsAndTransformation.transformation !== undefined ? { transform: boundsAndTransformation.transformation } : {})
    }

    // Check the invisibility first. If this rendering is supposed to be invisible, do not render it,
    // only render its children transformed by the transformation already calculated.
    if (isInvisible(styles)) {
        return <g />
    }

    // Default case. Calculate all svg objects and attributes needed to build this rendering from the styles and the rendering.
    const colorStyle = getSvgColorStyle(styles.kForeground as KForeground, context)
    const shadowStyles = getSvgShadowStyles(styles, context)
    const textStyles = getSvgTextStyles(styles)

    // The svg style of the resulting text element. If the text is only 1 line, the alignment-baseline attribute has to be
    // contained in the general style, otherwise it has to be repeated in every contained <tspan> element.
    let style = {
        ...{ 'dominant-baseline': textStyles.dominantBaseline },
        ...{ 'font-family': textStyles.fontFamily },
        ...{ 'font-size': textStyles.fontSize },
        ...{ 'font-style': textStyles.fontStyle },
        ...{ 'font-weight': textStyles.fontWeight },
        ...{ 'text-decoration-line': textStyles.textDecorationLine },
        ...{ 'text-decoration-style': textStyles.textDecorationStyle }
    }

    // The children to be contained in the returned text node.
    let children: any[]

    // The attributes to be contained in the returned text node.
    let attrs = {
        style: style,
        ...(boundsAndTransformation.bounds.y ? { y: boundsAndTransformation.bounds.y } : {}),
        fill: colorStyle,
        filter: shadowStyles,
        ...{ 'xml:space': 'preserve' } // This attribute makes the text size estimation include any trailing white spaces.
    } as any

    if (lines.length === 1) {
        // If the text has only one line, just put the text in the text node directly.
        attrs.x = boundsAndTransformation.bounds.x;
        children = [lines[0]]
    } else {
        // Otherwise, put each line of text in a separate <tspan> element.
        let dy: string | undefined = undefined
        children = []
        lines.forEach(line => {
            // If the line is just a blank line, add a dummy space character so the size estimation will
            // include this character without rendering anything further visible to the screen.
            // Also, the <tspan> attribute dy needs at least one character per text so the offset is correctly applied.
            if (line === '') {
                line = ' '
            }
            children.push(
                <tspan
                    x={boundsAndTransformation.bounds.x}
                    {...(dy ? { dy: dy } : {})}
                >{line}</tspan>
            )
            dy = '1.1em' // Have a distance of 1.1em for every new line after the first one.
        });
    }

    // build the element from the above defined attributes and children
    let element
    if (gAttrs.transform === undefined) {
        element = <text id={rendering.id} {...attrs}>
            {...children}
        </text>
    } else {
        element = <g id={rendering.id} {...gAttrs}>
            <text {...attrs}>
                {...children}
            </text>
        </g>
    }

    return element
}

/**
 * Renders all child renderings of the given container rendering.
 * @param parentRendering The parent rendering.
 * @param parent The parent element containing this rendering.
 * @param context The rendering context for this element.
 */
export function renderChildRenderings(parentRendering: KContainerRendering, parentElement: KGraphElement, context: KGraphRenderingContext): (VNode | undefined)[] {
    let renderings: (VNode | undefined)[] = []
    for (let childRendering of parentRendering.children) {
        let rendering = getRendering([childRendering], parentElement, context)
        renderings.push(rendering)
    }
    return renderings
}

export function renderError(rendering: KRendering) {
    return <text>
        {'Rendering cannot be drawn!\n' +
            'Type: ' + rendering.type + '\n' +
            'ID: ' + rendering.id}
    </text>
}

/**
 * Looks up the KRendering in the given data pool and generates a SVG rendering from that.
 * @param datas The list of possible KRenderings and additional data.
 * @param parent The parent element containing this rendering.
 * @param context The rendering context for this rendering.
 */
export function getRendering(datas: KGraphData[], parent: KGraphElement, context: KGraphRenderingContext): VNode | undefined {
    const kRenderingLibrary = datas.find(data => data !== null && data.type === K_RENDERING_LIBRARY)

    if (kRenderingLibrary !== undefined) {
        // register the rendering library if found in the parent node
        context.kRenderingLibrary = kRenderingLibrary as KRenderingLibrary
    }

    const kRendering = getKRendering(datas, context)

    if (kRendering === undefined) {
        return undefined
    }

    return renderKRendering(kRendering, parent, context)
}

/**
 * Translates any KRendering into an SVG rendering.
 * @param kRendering The rendering.
 * @param parent The parent element.
 * @param context The rendering context for this element.
 */
export function renderKRendering(kRendering: KRendering, parent: KGraphElement, context: KGraphRenderingContext): VNode | undefined { // TODO: not all of these are implemented yet
    switch (kRendering.type) {
        case K_CONTAINER_RENDERING: {
            console.error('A rendering can not be a ' + kRendering.type + ' by itself, it needs to be a subclass of it.')
            return undefined
        }
        case K_CHILD_AREA: {
            return renderChildArea(kRendering as KChildArea, parent, context)
        }
        case K_CUSTOM_RENDERING: {
            console.error('The rendering for ' + kRendering.type + ' is not implemented yet.')
            // data as KCustomRendering
            return undefined
        }
        case K_ARC:
        case K_ELLIPSE:
        case K_RECTANGLE:
        case K_ROUNDED_RECTANGLE: {
            return renderRectangularShape(kRendering as KContainerRendering, parent, context)
        }
        case K_IMAGE: {
            console.error('The rendering for ' + kRendering.type + ' is not implemented yet.')
            // data as KImage
            return undefined
        }
        case K_POLYLINE:
        case K_POLYGON:
        case K_ROUNDED_BENDS_POLYLINE:
        case K_SPLINE: {
            return renderLine(kRendering as KPolyline, parent, context)
        }
        case K_TEXT: {
            return renderKText(kRendering as KText, parent, context)
        }
        default: {
            console.error('The rendering is of an unknown type:' + kRendering.type)
            return undefined
        }
    }
}

/**
 * Looks up the first KRendering in the list of data and returns it. KRenderingReferences are handled and dereferenced as well, so only 'real' renderings are returned.
 * @param datas The list of possible renderings.
 * @param context The rendering context for this rendering.
 */
export function getKRendering(datas: KGraphData[], context: KGraphRenderingContext): KRendering | undefined {
    for (let data of datas) {
        if (data === null)
            continue
        if (data.type === K_RENDERING_REF) {
            const id = (data as KRenderingRef).id
            for (let rendering of context.kRenderingLibrary.renderings) {
                if (rendering.id === id) {
                    context.boundsMap = (data as KRenderingRef).calculatedBoundsMap
                    context.decorationMap = (data as KRenderingRef).calculatedDecorationMap
                    return rendering as KRendering
                }
            }
        }
        if (isRendering(data)) {
            return data
        }
    }
    return undefined
}

/**
 * Renders all junction points of the given edge.
 * @param edge The edge the junction points should be rendered for.
 * @param context The rendering context for this rendering.
 */
export function getJunctionPointRenderings(edge: KEdge, context: KGraphRenderingContext): VNode[] {
    const kRenderingLibrary = edge.data.find(data => data !== null && data.type === K_RENDERING_LIBRARY)

    if (kRenderingLibrary !== undefined) {
        // register the rendering library if found in the parent node
        context.kRenderingLibrary = kRenderingLibrary as KRenderingLibrary
    }

    const kRendering = getKRendering(edge.data, context)

    if (kRendering === undefined) {
        return []
    }

    // The rendering of an edge has to be a KPolyline or a sub type of KPolyline except KPolygon,
    // or a KCustomRendering providing a KCustomConnectionFigureNode.
    let junctionPointRendering: KRendering
    switch (kRendering.type) {
        case K_CUSTOM_RENDERING: {
            console.error('The rendering for ' + kRendering.type + ' is not implemented yet.')
            // junctionPointRendering = ?
            return []
        }
        case K_POLYLINE:
        case K_ROUNDED_BENDS_POLYLINE:
        case K_SPLINE: {
            junctionPointRendering = (kRendering as KPolyline).junctionPointRendering
            break
        }
        default: {
            console.error('The rendering of an edge has to be a KPolyline or a sub type of KPolyline except KPolygon, ' +
            'or a KCustomRendering providing a KCustomConnectionFigureNode, but is ' + kRendering.type)
            return []
        }
    }

    if (edge.junctionPoints.length === 0 || junctionPointRendering === undefined) {
        return []
    }
    // Render each junction point.
    const vNode = renderKRendering(junctionPointRendering, edge, context)
    if (vNode === undefined) {
        return []
    }

    const renderings: VNode[] = []
    edge.junctionPoints.forEach(junctionPoint => {
        const junctionPointVNode = <g transform = {`translate(${junctionPoint.x},${junctionPoint.y})`}>
            {vNode}
        </g>
        renderings.push(junctionPointVNode)
    })
    return renderings
}