export const extensionName = 'kieler'

/**
 * Object holding all information about the views of this extension.
 * view.id has to be the same as specified in package.json.
 */
export const views = {
    compiler: {
        id: 'kieler-kico',
        name: 'KIELER Compiler',
    },
    simulation: {
        id: 'kieler-simulation-tree',
        name: 'KIELER Simulation Tree',
    },
}

/**
 * Key, under which the settings for this extension are accessible.
 */
export const settingsKey = 'keith-vscode'

export type SimulationType = 'Manual' | 'Periodic' | 'Dynamic'

/**
 * Keys for all settings under the 'keith-vscode' namespace with their corresponding type.
 */
export type Settings = {
    'autocompile.enabled': boolean
    'compileInplace.enabled': boolean
    'showResultingModel.enabled': boolean
    'showButtons.enabled': boolean
    'showPrivateSystems.enabled': boolean
    /**
     * Time in milliseconds to wait till next simulation step is requested in play mode.
     */
    simulationStepDelay: number
    /**
     * The currently selected simulation type.
     */
    simulationType: SimulationType
    /**
     * Show internal variables of simulation (e.g. guards, ...).
     */
    'showInternalVariables.enabled': boolean
}
