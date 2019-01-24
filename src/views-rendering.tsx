/** @jsx svg */
import { svg } from 'snabbdom-jsx'
import { KChildArea, KGraphElement, KEllipse, KNode, KPort, KRoundedRectangle, KRectangle,
    KSpline, KEdge, KPolyline, KPolygon, KText, KLabel, KContainerRendering, KGraphData,
    KRenderingRef, KRenderingLibrary, KRoundedBendsPolyline, KForeground } from "./kgraph-models"
import { KGraphRenderingContext, findById, shadowFilter,
    lineCapText, lineJoinText, lineStyleText, evaluateKPosition, camelToKebab,
    verticalAlignmentText, calculateX, calculateY } from "./views-common"
import { isNullOrUndefined } from "util"
import { toDegrees, Point } from "sprotty/lib"
import { VNode } from "snabbdom/vnode"
import { getStyles, DEFAULT_LINE_WIDTH,
    DEFAULT_SHADOW, shadowDefinition, DEFAULT_MITER_LIMIT, DEFAULT_FONT_ITALIC,
    DEFAULT_FONT_BOLD, DEFAULT_VERTICAL_ALIGNMENT,
    DEFAULT_SHADOW_DEF,  getSvgColorStyles, getSvgColorStyle } from "./views-styles"
import { SVGAttributes } from 'react';
// import * as snabbdom from 'snabbdom-jsx'
// const JSX = {createElement: snabbdom.svg}


// ----------- Rendering Class names ----------- //
const K_RENDERING_REF = 'KRenderingRefImpl'
const K_RENDERING_LIBRARY = 'KRenderingLibraryImpl'
const K_CHILD_AREA = 'KChildAreaImpl'
const K_CONTAINER_RENDERING = 'KContainerRenderingImpl'
const K_ARC = 'KArcImpl'
const K_CUSTOM_RENDERING = 'KCustomRenderingImpl'
const K_ELLIPSE = 'KEllipseImpl'
const K_IMAGE = 'KImageImpl'
const K_POLYLINE = 'KPolylineImpl'
const K_POLYGON = 'KPolygonImpl'
const K_ROUNDED_BENDS_POLYLINE = 'KRoundedBendsPolylineImpl'
const K_SPLINE = 'KSplineImpl'
const K_RECTANGLE = 'KRectangleImpl'
const K_ROUNDED_RECTANGLE = 'KRoundedRectangleImpl'
const K_TEXT = 'KTextImpl'

// ----------------------------- Functions for rendering different KRendering as VNodes in svg --------------------------------------------

export function renderChildArea(rendering: KChildArea, parent: KGraphElement, context: KGraphRenderingContext) {
    if (isNullOrUndefined(rendering.calculatedBounds)) {
        console.error('computedBounds in child Area rendering is not defined!')
        return <g/>
    }
    if (parent.areChildrenRendered) {
        console.error('This element contains multiple child areas, skipping this one.')
        return <g/>
    }
    // remember, that this parent's children are now already rendered
    parent.areChildrenRendered = true

    // Only translate, if the translation is not 0.
    let gAttrs: SVGAttributes<SVGGElement>  = {}
    if (rendering.calculatedBounds.x !== 0 || rendering.calculatedBounds.y !== 0) {
        gAttrs.transform = `translate(${rendering.calculatedBounds.x}, ${rendering.calculatedBounds.y})`/*fixes chrome syntax HL: `*/
    }

    let element = <g {...gAttrs}>
        {context.renderChildren(parent)}
    </g>

    return element
}

export function renderKEllipse(rendering: KEllipse, parent: KGraphElement, context: KGraphRenderingContext): VNode {
    const styles = getStyles(rendering.styles, parent.id + rendering.id)
    const colorStyles = getSvgColorStyles(styles, parent, rendering)

    const lineWidth = styles.kLineWidth === null ? DEFAULT_LINE_WIDTH : styles.kLineWidth.lineWidth
    let bounds = undefined
    if (!isNullOrUndefined(rendering.calculatedBounds)) {
        bounds = rendering.calculatedBounds
    }
    if (isNullOrUndefined(bounds) && !isNullOrUndefined(context.boundsMap)) {
        bounds = findById(context.boundsMap, rendering.id)
    }

    let decoration = undefined
    if (!isNullOrUndefined(rendering.calculatedDecoration)) {
        decoration = rendering.calculatedDecoration
        bounds = {
            x: decoration.bounds.x + decoration.origin.x,
            y: decoration.bounds.y + decoration.origin.y,
            width: decoration.bounds.width,
            height: decoration.bounds.height
        }
    }
    if (isNullOrUndefined(decoration) && !isNullOrUndefined(context.decorationMap)) {
        decoration = findById(context.decorationMap, rendering.id)
        if (!isNullOrUndefined(decoration)) {
            bounds = {
                x: decoration.bounds.x + decoration.origin.x,
                y: decoration.bounds.y + decoration.origin.y,
                width: decoration.bounds.width,
                height: decoration.bounds.height
            }
        }
    }
    if (isNullOrUndefined(decoration) && isNullOrUndefined(bounds)) {
        console.error('could not find bounds or decoration data to render this KEllipse')
        return <g/>
    }

    // Only translate, if the translation is not 0.
    let gAttrs: SVGAttributes<SVGGElement>  = {}
    if (bounds.x !== 0 || bounds.y !== 0) {
        gAttrs.transform = `translate(${bounds.x}, ${bounds.y})`/*fixes chrome syntax HL: `*/
    }

    let element = <g {...gAttrs}>
        <ellipse
            cx = {bounds.width / 2}
            cy = {bounds.height / 2}
            rx = {bounds.width / 2}
            ry = {bounds.height / 2}
            style = {{
                'stroke-width': lineWidth
            } as React.CSSProperties}
            stroke = {colorStyles.foreground.color}
            fill = {colorStyles.background.color}
        />
        {renderChildRenderings(rendering, parent, context)}
    </g>

    if (colorStyles.background.definition) {
        (element.children as (string | VNode)[]).push(colorStyles.background.definition)
    }
    if (colorStyles.foreground.definition) {
        (element.children as (string | VNode)[]).push(colorStyles.foreground.definition)
    }
    // if (shadowDef) {
    //     (element.children as (string | VNode)[]).push(shadowDef)
    // } // TODO: implement shadow

    return element
}

export function renderKRectangle(rendering: KRectangle, parent: KGraphElement | KNode | KPort, context: KGraphRenderingContext): VNode {
    const roundedRendering = rendering as KRoundedRectangle
    // like this the rx and ry will be undefined during the rendering of a roundedRectangle and therefore those fields will be left out.
    // Rounded rectangles work in svg just like regular rectangles just with those two added variables, so this call will result in a regular rectangle.
    return renderKRoundedRectangle(roundedRendering, parent, context)
}

export function renderKRoundedRectangle(rendering: KRoundedRectangle, parent: KGraphElement | KNode | KPort, context: KGraphRenderingContext): VNode {
    const styles = getStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)
    const colorStyles = getSvgColorStyles(styles, parent, rendering)

    const lineWidth = styles.kLineWidth === null ? DEFAULT_LINE_WIDTH : styles.kLineWidth.lineWidth
    const opacity = styles.kInvisibility === null || styles.kInvisibility.invisible === false ? undefined : 0
    const shadow = styles.kShadow === undefined ? DEFAULT_SHADOW : shadowFilter((parent as KGraphElement).id + rendering.id)
    const shadowDef = styles.kShadow === undefined ? DEFAULT_SHADOW_DEF : shadowDefinition(styles.kShadow, (parent as KGraphElement).id + rendering.id)
    let width = undefined
    let height = undefined
    let x = undefined
    let y = undefined
    const rx = rendering.cornerWidth
    const ry = rendering.cornerHeight

    // findBounds(width, height, x, y, rendering.calculatedBounds, context.boundsMap) // TODO: maybe do it like this
    if (!isNullOrUndefined(rendering.calculatedBounds)) {
        // sizes are in the calculatedBounds of the rendering
        width = rendering.calculatedBounds.width
        height = rendering.calculatedBounds.height
        x = rendering.calculatedBounds.x
        y = rendering.calculatedBounds.y
    }
    // if no sizes have been found yet, they should be in the boundsMap
    if (isNullOrUndefined(x) && !isNullOrUndefined(context.boundsMap)) {
        // sizes should be found in the boundsMap in the context
        const bounds = findById(context.boundsMap, rendering.id)
        if (isNullOrUndefined(bounds)) {
            console.error('the boundsMap does not contain the id for this rendering.')
            console.error('boundsMap:')
            console.error(context.boundsMap)
            console.error('id:')
            console.error(rendering.id)
        } else {
            width = bounds.width
            height = bounds.height
            x = bounds.x
            y = bounds.y
        }
    }
    if (isNullOrUndefined(x)) { // if no value is found for x (and therefore also y) try to use the size of the parent itself, otherwise rendering will fail.
        console.error('calculatedBounds of this rendering are undefined or null and no bounds map in the rendering library can be found!')
        if (!('size' in parent)) { // if parent is not a KNode or KPort
            console.error('Rectangle renderings are only possible for KNodes or KPorts')
            return <g/>
        }
        width = parent.size.width
        height = parent.size.height
    }

    // Only translate, if the translation is not 0.
    let gAttrs: SVGAttributes<SVGGElement>  = {}
    if (x !== 0 || y !== 0) {
        gAttrs.transform = `translate(${x}, ${y})`/*fixes chrome syntax HL: `*/
    }

    let element = <g {...gAttrs}>
        <rect
            opacity = {opacity}
            x = {0}
            y = {0}
            width  = {width}
            height = {height}
            {...(rx ? {rx: rx} : {})}
            {...(ry ? {ry: ry} : {})}
            style = {{
                'stroke-width': lineWidth
            } as React.CSSProperties}
            stroke = {colorStyles.foreground.color}
            fill = {colorStyles.background.color}
            filter = {shadow}
        />
        {renderChildRenderings(rendering, parent, context)}
    </g>

    if (colorStyles.background.definition) {
        (element.children as (string | VNode)[]).push(colorStyles.background.definition)
    }
    if (colorStyles.foreground.definition) {
        (element.children as (string | VNode)[]).push(colorStyles.foreground.definition)
    }
    if (shadowDef) {
        (element.children as (string | VNode)[]).push(shadowDef)
    }

    return element
}

// TODO: if the parent element is not an edge, use the rendering.points instead of edge.routingPoints
export function renderKSpline(rendering: KSpline, parent: KGraphElement | KEdge, context: KGraphRenderingContext): VNode {
    // TODO: implement junction point rendering

    let bounds: any = undefined
    if (!isNullOrUndefined(rendering.calculatedBounds)) {
        bounds = rendering.calculatedBounds
    }
    if (isNullOrUndefined(bounds) && !isNullOrUndefined(context.boundsMap)) {
        bounds = findById(context.boundsMap, rendering.id)
    }
    if (isNullOrUndefined(bounds)) {
        console.error('Could not find bounds for this KSpline')
    }

    let points: Point[] = []
    // If the parent has routing points, the parent is an edge and those points have to be used.
    // Otherwise the parent has to have points itself.
    if ('routingPoints' in parent) {
        points = parent.routingPoints
    } else if ('points' in rendering) {
        const kPositions = rendering.points
        kPositions.forEach(kPosition => {
            const pos = evaluateKPosition(kPosition, bounds, true)
            points.push({
                x: pos.x + bounds.x,
                y: pos.y + bounds.y
            })
        });
    } else {
        console.error('The KSpline does not have any points for its routing.')
    }

    const styles = getStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)
    const foregroundStyles = getSvgColorStyle(styles.kForeground as KForeground, parent, rendering, true)

    const lineCap = styles.kLineCap === null ? undefined : lineCapText(styles.kLineCap)
    const lineWidth = styles.kLineWidth === null ? DEFAULT_LINE_WIDTH : styles.kLineWidth.lineWidth
    const lineJoin = styles.kLineJoin === null ? undefined : lineJoinText(styles.kLineJoin)
    const lineStyle = styles.kLineStyle === null ? undefined : lineStyleText(styles.kLineStyle, lineWidth)
    const miterLimit = styles.kLineJoin.miterLimit === null ? DEFAULT_MITER_LIMIT : styles.kLineJoin.miterLimit

    const firstPoint = points[0]
    let minX, maxX, minY, maxY: number
    if (!firstPoint) {
        return <g>
            {renderChildRenderings(rendering, parent, context)}
        </g>
    }

    minX = firstPoint.x
    maxX = firstPoint.x
    minY = firstPoint.y
    maxY = firstPoint.y
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i]
        if (p.x < minX) {
            minX = p.x
        }
        if (p.x > maxX) {
            maxX = p.x
        }
        if (p.y < minY) {
            minX = p.y
        }
        if (p.y > maxY) {
            maxY = p.y
        }
    }
    // hack to avoid paths with no width / height. These paths will not get drawn by chrome due to a bug in their svg renderer TODO: find a fix if there is any better way
    const EPSILON = 0.001
    if (points.length > 1) {
        let lastPoint = points[points.length - 1]
        let lastX = lastPoint.x
        let lastY = lastPoint.y
        // if this path has no width and the last point does not add anything to that, we need to shift one value by a tiny, invisible value so the width will now be bigger than 0.
        if (maxX - minX === 0 && lastX === maxX) {
            lastX += EPSILON
            points[points.length - 1] = {x: lastX, y: lastY}
        }
        // same for Y
        if (maxY - minY === 0 && lastY === maxY) {
            lastY += EPSILON
            points[points.length - 1] = {x: lastX, y: lastY}
        }
    }

    // now define the spline's path.
    let path = `M${firstPoint.x},${firstPoint.y}`
    for (let i = 1; i < points.length; i = i + 3) {
        let remainingPoints = points.length - i
        if (remainingPoints === 1) {
            // if one routing point is left, draw a straight line to there.
            path += `L${points[i].x},${points[i].y}`
        } else if (remainingPoints === 2) {
            // if two routing points are left, draw a quadratic bezier curve with those two points.
            path += `Q${points[i].x},${points[i].y} ${points[i + 1].x},${points[i + 1].y}`
        } else  {
            // if three or more routing points are left, draw a cubic bezier curve with those points.
            path += `C${points[i].x},${points[i].y} `
            + `${points[i + 1].x},${points[i + 1].y} `
            + `${points[i + 2].x},${points[i + 2].y}`
        }
    }

    let element = <g>
        <path
            d = {path}
            stroke = {foregroundStyles.color}
            fill = 'none'
            style = {{
                'stroke-linecap': lineCap,
                'stroke-linejoin': lineJoin,
                'stroke-width': lineWidth,
                'stroke-dasharray': lineStyle,
                'stroke-miterlimit': miterLimit
            } as React.CSSProperties}
        />
        {renderChildRenderings(rendering, parent, context)}
    </g>

    if (foregroundStyles.definition) {
        (element.children as (string | VNode)[]).push(foregroundStyles.definition)
    }

    return element
}

export function renderKPolyline(rendering: KPolyline, parent: KGraphElement | KEdge, context: KGraphRenderingContext): VNode {
    // TODO: implement junction point rendering

    let bounds: any = undefined
    if (!isNullOrUndefined(rendering.calculatedBounds)) {
        bounds = rendering.calculatedBounds
    }
    if (isNullOrUndefined(bounds) && !isNullOrUndefined(context.boundsMap)) {
        bounds = findById(context.boundsMap, rendering.id)
    }
    if (isNullOrUndefined(bounds)) {
        console.error('Could not find bounds for this KPolyline')
    }

    let points: Point[] = []
    // If the parent has routing points, the parent is an edge and those points have to be used.
    // Otherwise the parent has to have points itself.
    if ('routingPoints' in parent) {
        points = parent.routingPoints
    } else if ('points' in rendering) {
        const kPositions = rendering.points
        kPositions.forEach(kPosition => {
            const pos = evaluateKPosition(kPosition, bounds, true)
            points.push({
                x: pos.x + bounds.x,
                y: pos.y + bounds.y
            })
        });
    } else {
        console.error('The KPolyline does not have any points for its routing.')
    }

    const styles = getStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)
    const foregroundStyle = getSvgColorStyle(styles.kForeground as KForeground, parent, rendering, true)

    const lineCap = styles.kLineCap === null ? undefined : lineCapText(styles.kLineCap)
    const lineWidth = styles.kLineWidth === null ? DEFAULT_LINE_WIDTH : styles.kLineWidth.lineWidth
    const lineJoin = styles.kLineJoin === null ? undefined : lineJoinText(styles.kLineJoin)
    const lineStyle = styles.kLineStyle === null ? undefined : lineStyleText(styles.kLineStyle, lineWidth)
    const miterLimit = styles.kLineJoin.miterLimit === null ? DEFAULT_MITER_LIMIT : styles.kLineJoin.miterLimit

    const firstPoint = points[0]
    let minX, maxX, minY, maxY: number
    if (!firstPoint) {
        return <g>
            {renderChildRenderings(rendering, parent, context)}
        </g>
    }

    minX = firstPoint.x
    maxX = firstPoint.x
    minY = firstPoint.y
    maxY = firstPoint.y
    let path = `M${firstPoint.x},${firstPoint.y}`
    for (let i = 1; i < points.length - 1; i++) {
        const p = points[i]
        path += `L${p.x},${p.y}`

        if (p.x < minX) {
            minX = p.x
        }
        if (p.x > maxX) {
            maxX = p.x
        }
        if (p.y < minY) {
            minX = p.y
        }
        if (p.y > maxY) {
            maxY = p.y
        }
    }
    // hack to avoid paths with no width / height. These paths will not get drawn by chrome due to a bug in their svg renderer
    const EPSILON = 0.001
    if (points.length > 1) {
        let lastPoint = points[points.length - 1]
        let lastX = lastPoint.x
        let lastY = lastPoint.y
        // if this path has no width and the last point does not add anything to that, we need to shift one value by a tiny, invisible value so the width will now be bigger than 0.
        if (maxX - minX === 0 && lastX === maxX) {
            lastX += EPSILON
        }
        // same for Y
        if (maxY - minY === 0 && lastY === maxY) {
            lastY += EPSILON
        }
        path += `L${lastX},${lastY}`
    }
    let element = <g>
        <path
            d = {path}
            stroke = {foregroundStyle.color}
            fill = 'none'
            style = {{
                'stroke-linecap': lineCap,
                'stroke-linejoin': lineJoin,
                'stroke-width': lineWidth,
                'stroke-dasharray': lineStyle,
                'stroke-miterlimit': miterLimit
            } as React.CSSProperties}
        />
        {renderChildRenderings(rendering, parent, context)}
    </g>

    if (foregroundStyle.definition) {
        (element.children as (string | VNode)[]).push(foregroundStyle.definition)
    }

    return element
}

export function renderKRoundedBendsPolyline(rendering: KRoundedBendsPolyline, parent: KGraphElement | KEdge, context: KGraphRenderingContext): VNode {
    // TODO: implement junction point rendering
    let bounds: any = undefined
    if (!isNullOrUndefined(rendering.calculatedBounds)) {
        bounds = rendering.calculatedBounds
    }
    if (isNullOrUndefined(bounds) && !isNullOrUndefined(context.boundsMap)) {
        bounds = findById(context.boundsMap, rendering.id)
    }
    if (isNullOrUndefined(bounds)) {
        console.error('Could not find bounds for this KPolyline')
    }

    let points: Point[] = []
    // If the parent has routing points, the parent is an edge and those points have to be used.
    // Otherwise the parent has to have points itself.
    if ('routingPoints' in parent) {
        points = parent.routingPoints
    } else if ('points' in rendering) {
        const kPositions = rendering.points
        kPositions.forEach(kPosition => {
            const pos = evaluateKPosition(kPosition, bounds, true)
            points.push({
                x: pos.x + bounds.x,
                y: pos.y + bounds.y
            })
        });
    } else {
        console.error('The KPolyline does not have any points for its routing.')
    }

    const styles = getStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)
    const foregroundStyle = getSvgColorStyle(styles.kForeground as KForeground, parent, rendering, true)

    const lineCap = styles.kLineCap === null ? undefined : lineCapText(styles.kLineCap)
    const lineWidth = styles.kLineWidth === null ? DEFAULT_LINE_WIDTH : styles.kLineWidth.lineWidth
    const lineJoin = styles.kLineJoin === null ? undefined : lineJoinText(styles.kLineJoin)
    const lineStyle = styles.kLineStyle === null ? undefined : lineStyleText(styles.kLineStyle, lineWidth)
    const miterLimit = styles.kLineJoin.miterLimit === null ? DEFAULT_MITER_LIMIT : styles.kLineJoin.miterLimit
    const bendRadius = rendering.bendRadius

    const firstPoint = points[0]
    let minX, maxX, minY, maxY: number
    if (!firstPoint) {
        return <g>
            {renderChildRenderings(rendering, parent, context)}
        </g>
    }

    minX = firstPoint.x
    maxX = firstPoint.x
    minY = firstPoint.y
    maxY = firstPoint.y
    let path = `M${firstPoint.x},${firstPoint.y}`
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
        // draw a line to the start of the bend point (from the last end of its bend) and then draw the bend with the control points of the point itself and the bend end point.
        path += `L${xs},${ys}Q${xp},${yp} ${xe},${ye}`

        if (xp < minX) {
            minX = xp
        }
        if (xp > maxX) {
            maxX = xp
        }
        if (yp < minY) {
            minX = yp
        }
        if (yp > maxY) {
            maxY = yp
        }
    }
    // hack to avoid paths with no width / height. These paths will not get drawn by chrome due to a bug in their svg renderer
    const EPSILON = 0.001
    if (points.length > 1) {
        let lastPoint = points[points.length - 1]
        let lastX = lastPoint.x
        let lastY = lastPoint.y
        // if this path has no width and the last point does not add anything to that, we need to shift one value by a tiny, invisible value so the width will now be bigger than 0.
        if (maxX - minX === 0 && lastX === maxX) {
            lastX += EPSILON
        }
        // same for Y
        if (maxY - minY === 0 && lastY === maxY) {
            lastY += EPSILON
        }
        path += `L${lastX},${lastY}`
    }
    let element = <g>
        <path
            d = {path}
            stroke = {foregroundStyle.color}
            fill = 'none'
            style = {{
                'stroke-linecap': lineCap,
                'stroke-linejoin': lineJoin,
                'stroke-width': lineWidth,
                'stroke-dasharray': lineStyle,
                'stroke-miterlimit': miterLimit
            } as React.CSSProperties}
        />
        {renderChildRenderings(rendering, parent, context)}
    </g>

    if (foregroundStyle.definition) {
        (element.children as (string | VNode)[]).push(foregroundStyle.definition)
    }

    return element
}

export function renderKPolygon(rendering: KPolygon, parent: KGraphElement, context: KGraphRenderingContext): VNode {
    const styles = getStyles(rendering.styles, parent.id + rendering.id)
    const colorStyles = getSvgColorStyles(styles, parent, rendering)
    const lineCap = styles.kLineCap === null ? undefined : lineCapText(styles.kLineCap)
    const lineWidth = styles.kLineWidth === null ? DEFAULT_LINE_WIDTH : styles.kLineWidth.lineWidth
    const lineJoin = styles.kLineJoin === null ? undefined : lineJoinText(styles.kLineJoin)
    const lineStyle = styles.kLineStyle === null ? undefined : lineStyleText(styles.kLineStyle, lineWidth)
    const miterLimit = styles.kLineJoin.miterLimit === null ? DEFAULT_MITER_LIMIT : styles.kLineJoin.miterLimit

    // hack to fix the border being drawn although it should not
    // FIXME: find out, how to not have to use this hack.
    if (lineWidth === 0) {
        colorStyles.foreground.color = null as any
    }

    let bounds = undefined
    if (!isNullOrUndefined(rendering.calculatedBounds)) {
        bounds = rendering.calculatedBounds
    }
    if (isNullOrUndefined(bounds) && !isNullOrUndefined(context.boundsMap)) {
        bounds = findById(context.boundsMap, rendering.id)
    }

    let decoration = undefined
    if (!isNullOrUndefined(rendering.calculatedDecoration)) {
        decoration = rendering.calculatedDecoration
        bounds = {
            x: decoration.bounds.x + decoration.origin.x,
            y: decoration.bounds.y + decoration.origin.y,
            width: decoration.bounds.width,
            height: decoration.bounds.height
        }
    }
    if (isNullOrUndefined(decoration) && !isNullOrUndefined(context.decorationMap)) {
        decoration = findById(context.decorationMap, rendering.id)
        if (!isNullOrUndefined(decoration)) {
            bounds = {
                x: decoration.bounds.x + decoration.origin.x,
                y: decoration.bounds.y + decoration.origin.y,
                width: decoration.bounds.width,
                height: decoration.bounds.height
            }
        }
    }
    if (isNullOrUndefined(decoration) && isNullOrUndefined(bounds)) {
        console.error('could not find bounds or decoration data to render this KPolygon')
        return <g/>
    }

    const firstPoint = evaluateKPosition(rendering.points[0], bounds, true)
    if (!firstPoint) {
        return <g>
            {renderChildRenderings(rendering, parent, context)}
        </g>
    }

    let path = `M${firstPoint.x + bounds.x},${firstPoint.y + bounds.y}`
    for (let i = 1; i < rendering.points.length; i++) {
        const p = evaluateKPosition(rendering.points[i], bounds, true)
        path += `L${p.x + bounds.x},${p.y + bounds.y}`
    }
    path += 'Z'

    // Only rotate, if the rotation is not 0.
    let gAttrs: SVGAttributes<SVGGElement>  = {}
    if (decoration &&  toDegrees(decoration.rotation) !== 0) {
        gAttrs.transform = `translate(${decoration.origin.x},${decoration.origin.y}) `
                         + `rotate(${toDegrees(decoration.rotation)}) `
                         + `translate(${-decoration.origin.x},${-decoration.origin.y})`
    }

    let element = <g {...gAttrs}>
        <path
            d = {path}
            {...(colorStyles.foreground.color ? {stroke: colorStyles.foreground.color} : {})}
            fill = {colorStyles.background.color}
            style = {{
                'stroke-linecap': lineCap,
                'stroke-linejoin': lineJoin,
                'stroke-width': lineWidth,
                'stroke-dasharray': lineStyle,
                'stroke-miterlimit': miterLimit
            } as React.CSSProperties}
        />
        {renderChildRenderings(rendering, parent, context)}
    </g>

    if (colorStyles.background.definition) {
        (element.children as (string | VNode)[]).push(colorStyles.background.definition)
    }
    if (colorStyles.foreground.definition) {
        (element.children as (string | VNode)[]).push(colorStyles.foreground.definition)
    }

    return element
}

export function renderKText(rendering: KText, parent: KGraphElement | KLabel, context: KGraphRenderingContext): VNode {
    const styles = getStyles(rendering.styles, (parent as KGraphElement).id + rendering.id)

    let text = null
    // KText elements as renderings of labels have their text in the KLabel, not the KText
    if ('text' in parent) { // if parent is KLabel
        text = parent.text
    } else {
        text = rendering.text
    }
    if (isNullOrUndefined(text)) return <g/>

    const colorStyle = getSvgColorStyle(styles.kForeground as KForeground, parent, rendering, true)

    const italic = styles.kFontItalic.italic === DEFAULT_FONT_ITALIC ? null : 'italic'
    const bold = styles.kFontBold.bold === DEFAULT_FONT_BOLD ? null : 'bold'
    const fontName = camelToKebab(styles.kFontName.name)

    const verticalAlignment = verticalAlignmentText(styles.kVerticalAlignment.verticalAlignment === null ? DEFAULT_VERTICAL_ALIGNMENT : styles.kVerticalAlignment.verticalAlignment)

    let lines = text.split("\n")

    let x: number | undefined = undefined
    let y: number | undefined = undefined
    let textWidth = undefined
    if (!isNullOrUndefined(rendering.calculatedTextBounds)) {
        textWidth = rendering.calculatedTextBounds.width
    }

    if (!isNullOrUndefined(rendering.calculatedBounds)) {
        x = calculateX(rendering.calculatedBounds.x, rendering.calculatedBounds.width, styles.kHorizontalAlignment, textWidth)
        y = calculateY(rendering.calculatedBounds.y, rendering.calculatedBounds.height, styles.kVerticalAlignment, lines.length)
    }
    // if no bounds have been found yet, they should be in the boundsMap
    if (isNullOrUndefined(x) && !isNullOrUndefined(context.boundsMap)) {
        const bounds = findById(context.boundsMap, rendering.id)
        if (isNullOrUndefined(bounds)) {
            console.error('the boundsMap does not contain the id for this rendering.')
        } else {
            x = calculateX(bounds.x, bounds.width, styles.kHorizontalAlignment, textWidth)
            y = calculateY(bounds.y, bounds.height, styles.kVerticalAlignment, lines.length)
        }
    }

    // If still no bounds are found, set x to 0. This will be the case when the texts are drawn first to estimate their sizes.
    // Multiline texts should still be rendered beneath each other, so the x coordinate is important for each <tspan>
    if (isNullOrUndefined(x)) {
        x = 0
    }

    let style = {
        ...{'font-family': fontName},
        ...{'font-size': styles.kFontSize.size + 'pt'},
        ...{'font-style': italic},
        ...{'font-weight': bold}
    } as React.CSSProperties

    let textNode = <text
        style = {style}
        {...(y ? {y: y} : {})}
        fill = {colorStyle.color}
        {...{'xml:space' : "preserve"}/* This attribute makes the text size estimation include any trailing white spaces. */}
    />

    let dy: string | undefined = undefined
    lines.forEach((line, index) => {
        // If the line is just a blank line, add a dummy space character so the size estimation will
        // include this character without rendering anything further visible to the screen.
        // Also, the <tspan> attribute dy needs at least one character per text so the offset is correctly applied.
        if (line === "") {
            line = " "
        }
        (textNode.children as (string | VNode)[]).push(
            <tspan
                style = {{
                    'alignment-baseline': verticalAlignment, // Somehow, svg ignores this style on its parent. So repeat it here for every individual tspan.
                } as React.CSSProperties}
                x = {x}
                {...(dy ? {dy: dy} : {})}
            >{line}</tspan>
        )
        dy = '1.1em' // Have a distance of 1.1em for every new line after the first one.
    });

    if (colorStyle.definition) {
        return <g>
            {colorStyle.definition}
            {textNode}
        </g>
    } else {
        return textNode
    }
}

export function renderChildRenderings(parentRendering: KContainerRendering, parentElement: KGraphElement, context: KGraphRenderingContext): (VNode | null)[] {
    let renderings: (VNode | null)[] = []
    for (let childRendering of parentRendering.children) {
        let rendering = getRendering([childRendering], parentElement, context)
        renderings.push(rendering)
    }
    return renderings
}

export function getRendering(datas: KGraphData[], parent: KGraphElement, context: KGraphRenderingContext): VNode | null { // TODO: not all of these are implemented yet
    for (let data of datas) {
        if (data === null)
            continue
        if (data.type === K_RENDERING_REF) {
            const id = (data as KRenderingRef).id
            for (let rendering of context.kRenderingLibrary.renderings) {
                if (rendering.id === id) {
                    context.boundsMap = (data as KRenderingRef).calculatedBoundsMap
                    context.decorationMap = (data as KRenderingRef).calculatedDecorationMap
                    data = rendering as any // TODO: fix: persistentEntry is missing
                }
            }
        }
        switch (data.type) {
            case K_RENDERING_LIBRARY: {
                // register the rendering library if found in the parent node
                context.kRenderingLibrary = data as KRenderingLibrary
                break
            }
            case K_CONTAINER_RENDERING: {
                console.error('A rendering can not be a ' + data.type + ' by itself, it needs to be a subclass of it.')
                break
            }
            case K_CHILD_AREA: {
                return renderChildArea(data as KChildArea, parent, context)
            }
            case K_ARC: {
                console.error('The rendering for ' + data.type + ' is not implemented yet.')
                // data as KArc
                break
            }
            case K_CUSTOM_RENDERING: {
                console.error('The rendering for ' + data.type + ' is not implemented yet.')
                // data as KCustomRendering
                break
            }
            case K_ELLIPSE: {
                return renderKEllipse(data as KEllipse, parent, context)
            }
            case K_IMAGE: {
                console.error('The rendering for ' + data.type + ' is not implemented yet.')
                // data as KImage
                break
            }
            case K_POLYLINE: {
                return renderKPolyline(data as KPolyline, parent, context)
            }
            case K_POLYGON: {
                return renderKPolygon(data as KPolygon, parent, context)
            }
            case K_ROUNDED_BENDS_POLYLINE: {
                return renderKRoundedBendsPolyline(data as KRoundedBendsPolyline, parent, context)
            }
            case K_SPLINE: {
                return renderKSpline(data as KSpline, parent, context)
            }
            case K_RECTANGLE: {
                return renderKRectangle(data as KRectangle, parent, context)
            }
            case K_ROUNDED_RECTANGLE: {
                return renderKRoundedRectangle(data as KRoundedRectangle, parent, context)
            }
            case K_TEXT: {
                return renderKText(data as KText, parent, context)
            }
            default: {
                // do nothing. The data is something other than a rendering
                break
            }
        }
    }
    return null
}