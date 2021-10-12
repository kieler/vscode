/*
 * KIELER - Kiel Integrated Environment for Layout Eclipse RichClient
 *
 * http://rtsys.informatik.uni-kiel.de/kieler
 *
 * Copyright 2021 by
 * + Kiel University
 *   + Department of Computer Science
 *     + Real-Time and Embedded Systems Group
 *
 * This code is provided under the terms of the Eclipse Public License (EPL).
 */
// @ts-ignore
const vscodeApi = acquireVsCodeApi();

/**
 * Use webpack to build a js file from this that is included in the html of the SimulationWebView
 * This is used to communicate with the rest of the extension
 */
export class SimulationViewStarter {

    constructor() {
        this.sendReadyMessage();
        this.waitForStuff();
    }

    protected sendReadyMessage(): void {
        console.log('I am ready')
        vscodeApi.postMessage({ readyMessage: 'Simulation view ready' } as any);
    }

    protected waitForStuff(): void {
        console.log('Waiting stuff...');
        const eventListener = (message: any) => {
            // TODO
            console.log(message)
        };
        window.addEventListener('message', eventListener);
    }
}

new SimulationViewStarter()