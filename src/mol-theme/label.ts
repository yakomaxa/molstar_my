/**
 * Copyright (c) 2018-2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { Unit, StructureElement, StructureProperties as Props, Link } from '../mol-model/structure';
import { Loci } from '../mol-model/loci';
import { OrderedSet } from '../mol-data/int';
import { capitalize } from '../mol-util/string';
import { Column } from '../mol-data/db';

// for `labelFirst`, don't create right away to avoid problems with circular dependencies/imports
let elementLocA: StructureElement.Location
let elementLocB: StructureElement.Location

function setElementLocation(loc: StructureElement.Location, unit: Unit, index: StructureElement.UnitIndex) {
    loc.unit = unit
    loc.element = unit.elements[index]
}

export function lociLabel(loci: Loci): string {
    switch (loci.kind) {
        case 'structure-loci':
            return loci.structure.models.map(m => m.entry).join(', ')
        case 'element-loci':
            return structureElementStatsLabel(StructureElement.Stats.ofLoci(loci))
        case 'link-loci':
            const link = loci.links[0]
            return link ? linkLabel(link) : 'Unknown'
        case 'shape-loci':
            return loci.shape.name
        case 'group-loci':
            const g = loci.groups[0]
            return g ? loci.shape.getLabel(OrderedSet.start(g.ids), loci.instance) : 'Unknown'
        case 'every-loci':
            return 'Everything'
        case 'empty-loci':
            return 'Nothing'
        case 'data-loci':
            return ''
    }
}

function countLabel(count: number, label: string) {
    return count === 1 ? `1 ${label}` : `${count} ${label}s`
}

function otherLabel(count: number, location: StructureElement.Location, granularity: LabelGranularity) {
    return `${elementLabel(location, granularity)} [+ ${countLabel(count - 1, `other ${capitalize(granularity)}`)}]`
}

/** Gets residue count of the model chain segments the unit is a subset of */
function getResidueCount(unit: Unit.Atomic) {
    const { elements, model } = unit
    const { chainAtomSegments, residueAtomSegments } = model.atomicHierarchy
    const elementStart = chainAtomSegments.offsets[chainAtomSegments.index[elements[0]]]
    const elementEnd = chainAtomSegments.offsets[chainAtomSegments.index[elements[elements.length - 1]] + 1]
    return residueAtomSegments.index[elementEnd] - residueAtomSegments.index[elementStart]
}

export function structureElementStatsLabel(stats: StructureElement.Stats, countsOnly = false): string {
    const { unitCount, residueCount, elementCount } = stats

    if (!countsOnly && elementCount === 1 && residueCount === 0 && unitCount === 0) {
        return elementLabel(stats.firstElementLoc, 'element')
    } else if (!countsOnly && elementCount === 0 && residueCount === 1 && unitCount === 0) {
        return elementLabel(stats.firstResidueLoc, 'residue')
    } else if (!countsOnly && elementCount === 0 && residueCount === 0 && unitCount === 1) {
        const { unit } = stats.firstUnitLoc
        const granularity = (Unit.isAtomic(unit) && getResidueCount(unit) === 1) ? 'residue' : 'chain'
        return elementLabel(stats.firstUnitLoc, granularity)
    } else if (!countsOnly) {
        const label: string[] = []
        if (unitCount > 0) label.push(unitCount === 1 ? elementLabel(stats.firstElementLoc, 'chain') : otherLabel(unitCount, stats.firstElementLoc, 'chain'))
        if (residueCount > 0) label.push(residueCount === 1 ? elementLabel(stats.firstElementLoc, 'residue') : otherLabel(residueCount, stats.firstElementLoc, 'residue'))
        if (elementCount > 0) label.push(elementCount === 1 ? elementLabel(stats.firstElementLoc, 'element') : otherLabel(elementCount, stats.firstElementLoc, 'element'))
        return label.join(', ')
    } else {
        const label: string[] = []
        if (unitCount > 0) label.push(countLabel(unitCount, 'Chain'))
        if (residueCount > 0) label.push(countLabel(residueCount, 'Residue'))
        if (elementCount > 0) label.push(countLabel(elementCount, 'Element'))
        return label.join(', ')
    }
}

export function linkLabel(link: Link.Location): string {
    if (!elementLocA) elementLocA = StructureElement.Location.create()
    if (!elementLocB) elementLocB = StructureElement.Location.create()
    setElementLocation(elementLocA, link.aUnit, link.aIndex)
    setElementLocation(elementLocB, link.bUnit, link.bIndex)
    const labelA = _elementLabel(elementLocA)
    const labelB = _elementLabel(elementLocB)
    let offset = 0
    for (let i = 0, il = Math.min(labelA.length, labelB.length); i < il; ++i) {
        if (labelA[i] === labelB[i]) offset += 1
        else break
    }
    return `${labelA.join(' | ')} \u2014 ${labelB.slice(offset).join(' | ')}`
}

export type LabelGranularity = 'element' | 'residue' | 'chain' | 'structure'

export function elementLabel(location: StructureElement.Location, granularity: LabelGranularity = 'element'): string {
    return _elementLabel(location, granularity).join(' | ')
}

function _elementLabel(location: StructureElement.Location, granularity: LabelGranularity = 'element'): string[] {
    const entry = `<small>${location.unit.model.entry}</small>`
    const model = `<small>Model ${location.unit.model.modelNum}</small>`
    const instance = `<small>Instance ${location.unit.conformation.operator.name}</small>`
    const label = [entry, model, instance]

    if (Unit.isAtomic(location.unit)) {
        label.push(..._atomicElementLabel(location as StructureElement.Location<Unit.Atomic>, granularity))
    } else if (Unit.isCoarse(location.unit)) {
        label.push(..._coarseElementLabel(location as StructureElement.Location<Unit.Spheres | Unit.Gaussians>, granularity))
    } else {
        label.push('Unknown')
    }

    return label
}

function _atomicElementLabel(location: StructureElement.Location<Unit.Atomic>, granularity: LabelGranularity): string[] {
    const label_asym_id = Props.chain.label_asym_id(location)
    const auth_asym_id = Props.chain.auth_asym_id(location)
    const has_label_seq_id = location.unit.model.atomicHierarchy.residues.label_seq_id.valueKind(location.element) === Column.ValueKind.Present;
    const label_seq_id = Props.residue.label_seq_id(location)
    const auth_seq_id = Props.residue.auth_seq_id(location)
    const ins_code = Props.residue.pdbx_PDB_ins_code(location)
    const comp_id = Props.residue.label_comp_id(location)
    const atom_id = Props.atom.label_atom_id(location)
    const alt_id = Props.atom.label_alt_id(location)

    const microHetCompIds = Props.residue.microheterogeneityCompIds(location)
    const compId = granularity === 'residue' && microHetCompIds.length > 1 ?
        `(${microHetCompIds.join('|')})` : comp_id

    const label: string[] = []

    switch (granularity) {
        case 'element':
            label.push(`<b>${atom_id}</b>${alt_id ? `%${alt_id}` : ''}`)
        case 'residue':
            label.push(`<b>${compId} ${has_label_seq_id ? label_seq_id : ''}</b>${label_seq_id !== auth_seq_id ? ` <small> [auth</small> <b>${auth_seq_id}</b><small>]</small>` : ''}<b>${ins_code ? ins_code : ''}</b>`)
        case 'chain':
            if (label_asym_id === auth_asym_id) {
                label.push(`<b>${label_asym_id}</b>`)
            } else {
                label.push(`<b>${label_asym_id}</b> <small>[auth</small> <b>${auth_asym_id}</b><small>]</small>`)
            }
    }

    return label.reverse()
}

function _coarseElementLabel(location: StructureElement.Location<Unit.Spheres | Unit.Gaussians>, granularity: LabelGranularity): string[] {
    const asym_id = Props.coarse.asym_id(location)
    const seq_id_begin = Props.coarse.seq_id_begin(location)
    const seq_id_end = Props.coarse.seq_id_end(location)

    const label: string[] = []

    switch (granularity) {
        case 'element':
        case 'residue':
            if (seq_id_begin === seq_id_end) {
                const entityIndex = Props.coarse.entityKey(location)
                const seq = location.unit.model.sequence.byEntityKey[entityIndex]
                const comp_id = seq.sequence.compId.value(seq_id_begin - 1) // 1-indexed
                label.push(`<b>${comp_id} ${seq_id_begin}-${seq_id_end}</b>`)
            } else {
                label.push(`<b>${seq_id_begin}-${seq_id_end}</b>`)
            }
        case 'chain':
            label.push(`<b>${asym_id}</b>`)
    }

    return label.reverse()
}