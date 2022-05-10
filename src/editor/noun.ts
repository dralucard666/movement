import produce, { freeze } from "immer"
import { EditorState, ValueMap, SelectionsList, SelectionPattern } from "."
import {
    toHierarchicalSteps,
    AbstractParsedSymbol,
    HierarchicalParsedGrammarDefinition,
    HierarchicalParsedSteps,
    HierarchicalInfo,
} from ".."
import { AbstractParsedGrammarDefinition, ParsedSteps } from "../parser"
import { computeDependencies, getDescriptionOfNoun, getNounIndex, traverseSteps } from "../util"
import { insert } from "./insert"
import { replaceOnDraft } from "./replace"
import { getIndirectParentsSteps, getRelatedSelections, getSelectedStepsPath } from "./selection"

export function removeUnusedNouns<T>(
    grammar: AbstractParsedGrammarDefinition<T>,
    selectionsList: SelectionsList<any, any>,
    descriptionNames?: Array<string>
): { selectionsList: SelectionsList<any, any>; grammar: AbstractParsedGrammarDefinition<T> } {
    const usedNouns = new Set<string>()
    const foundDescriptions = new Set<string>()
    for (const { name: rootName, step: rootStep } of grammar) {
        const descriptionName = getDescriptionOfNoun(rootName)
        if (
            !foundDescriptions.has(descriptionName) &&
            (descriptionNames == null || descriptionNames.includes(descriptionName))
        ) {
            usedNouns.add(rootName)
            foundDescriptions.add(descriptionName)
        }
        traverseSteps(rootStep, (steps) => {
            if (steps.type === "symbol" && steps.identifier !== rootName) {
                usedNouns.add(steps.identifier)
            }
        })
    }
    return {
        grammar: freeze(grammar.filter((noun) => usedNouns.has(noun.name))),
        selectionsList: selectionsList.filter((selections) => usedNouns.has(getSelectedStepsPath(selections.steps)[0])),
    }
}

export async function setName<T, A>(
    indicesMap: ValueMap<T, A>,
    selectionsList: SelectionsList<T, A>,
    patterns: Array<SelectionPattern<T, A>>,
    selectCondition: (conditionSteps: Array<ParsedSteps>) => Promise<ParsedSteps | undefined>,
    name: string,
    grammar: HierarchicalParsedGrammarDefinition
): Promise<EditorState> {
    const nounIndex = getNounIndex(name, grammar)
    if (nounIndex == null) {
        grammar = produce(grammar, (draft) => {
            draft.push({ name, step: { type: "this", path: [name] } })
        })
    }
    const state = await insert(
        indicesMap,
        selectionsList,
        patterns,
        selectCondition,
        "after",
        () => ({ type: "symbol", identifier: name }),
        grammar
    )
    return {
        ...state,
        selectionsList: [{ steps: name, values: [] }],
    }
}

export async function renameNoun<T, A>(
    indicesMap: ValueMap<T, A>,
    selectionsList: SelectionsList<T, A>,
    patterns: Array<SelectionPattern<T, A>>,
    selectCondition: (conditionSteps: Array<ParsedSteps>) => Promise<ParsedSteps | undefined>,
    newName: string,
    grammar: HierarchicalParsedGrammarDefinition
): Promise<EditorState> {
    const partial = await produce(
        { grammar, selectionsList: [] as SelectionsList },
        async ({ grammar: draft, selectionsList: newSelectionsList }) => {
            for (const selections of selectionsList) {
                if (typeof selections.steps !== "string") {
                    continue
                }
                const name = selections.steps
                const existingNounIndex = getNounIndex(name, grammar)
                const existingNounIndexOnDraft = getNounIndex(name, draft)
                if (
                    getNounIndex(newName, draft) != null ||
                    existingNounIndex == null ||
                    existingNounIndexOnDraft == null
                ) {
                    continue
                }

                //this clones the step as we use the frozen grammar[index].step (and toHierarchicalSteps internally uses produce if the parameter is frozen)
                const clonedSteps = toHierarchicalSteps(freeze(grammar[existingNounIndex].step, false), newName)

                draft.splice(existingNounIndexOnDraft, 0, {
                    name: newName,
                    step: clonedSteps,
                })

                const parents = getIndirectParentsSteps(name, draft)
                if (parents.length > 0) {
                    const upwardSelections = getRelatedSelections(
                        indicesMap,
                        parents,
                        selections.indices,
                        (current, next) => current.before.startsWith(next.before),
                        undefined
                    )

                    await replaceOnDraft(
                        indicesMap,
                        upwardSelections,
                        patterns,
                        selectCondition,
                        () => ({ type: "symbol", identifier: newName }),
                        draft
                    )
                }

                newSelectionsList.push({
                    steps: newName,
                    values: [],
                })
            }
        }
    )
    const cleanedPartial = removeUnusedNouns(partial.grammar, partial.selectionsList)
    return {
        hovered: undefined,
        valueMap: {},
        ...cleanedPartial,
        dependencyMap: computeDependencies(cleanedPartial.grammar),
    }
}

export function findSymbolsWithIdentifier(
    root: HierarchicalParsedSteps,
    identifier: string,
    onFound: (step: AbstractParsedSymbol<HierarchicalInfo>) => void
): void {
    traverseSteps(root, (step) => {
        if (step.type === "symbol" && step.identifier === identifier) {
            onFound(step)
        }
    })
}
