/**
 * Copyright (c) 2017-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Panagiotis Tourlas <panagiot_tourlov@hotmail.com>
 */

import { MolScriptBuilder } from '../../../mol-script/language/builder';
const B = MolScriptBuilder;
import { PropertyDict } from '../types';

//const reFloat = /[-+]?[0-9]*\.?[0-9]+/;
// const rePosInt = /[0-9]+/;

function atomNameListMap(x: string) { return x.split(',').map(B.atomName); }
function listMap(x: string) { return x.split(',').map(x => x.replace(/^["']|["']$/g, '')); }
function rangeMap(x: string) {
    const [min, max] = x.split('-').map(x => parseInt(x));
    return { min, max };
}
function listOrRangeMap(x: string) {
    if (x.includes('-') && x.includes(',')){
	const pSplit = x.split(',').map(x => x.replace(/^["']|["']$/g, ''));
	console.log(pSplit)
	const res : number[] =[];
	pSplit.forEach( x => {
	    if (x.includes('-')){
		const [min, max] = x.split('-').map(x=>parseInt(x));
		for (var i = min;  i <= max;  i++){
		    res.push(i);
		}		 
	    }else{
		res.push(parseInt(x));
	    }
	});
	return res;		    	
    }else if(x.includes('-') && !x.includes(',')){
	return rangeMap(x)
    }else if(!x.includes('-') && x.includes(',')){
	return listMap(x).map(x => parseInt(x));
    }else{	
	return parseInt(x);
    }
}
function elementListMap(x: string) {
    return x.split(',').map(B.struct.type.elementSymbol);
}

//const sstrucDict: { [k: string]: string } = {
//    H: 'helix',
//    S: 'beta',
//    L: 'none'
//};
//function sstrucListMap(x: string) {
//    return {
//        flags: B.struct.type.secondaryStructureFlags(
//            x.toUpperCase().split('+').map(ss => sstrucDict[ss] || 'none')
//        )
//    };
//}

export const special_properties: PropertyDict = {
    symbol: {
        '@desc': 'chemical-symbol-list: list of 1- or 2-letter chemical symbols from the periodic table',
        '@examples': ['symbol O+N'],
        abbr: ['e.'], regex: /[a-zA-Z'",]+/, map: elementListMap,
        level: 'atom-test', property: B.acp('elementSymbol')
    },
    name: {
        '@desc': 'atom-name-list: list of up to 4-letter codes for atoms in proteins or nucleic acids',
        '@examples': ['name CA+CB+CG+CD'],
        abbr: ['n.'], regex: /[a-zA-Z0-9'",]+/, map: atomNameListMap,
        level: 'atom-test', property: B.ammp('label_atom_id')
    },
    resn: {
        '@desc': 'residue-name-list: list of 3-letter codes for amino acids or list of up to 2-letter codes for nucleic acids',
        '@examples': ['resn ASP+GLU+ASN+GLN', 'resn A+G'],
        abbr: ['resname', 'r.'], regex: /[a-zA-Z0-9'",]+/, map: listMap,
        level: 'residue-test', property: B.ammp('label_comp_id')
    },
    resi: {
        '@desc': 'residue-identifier-list list of up to 4-digit residue numbers or residue-identifier-range',
        '@examples': ['resi 1+10+100+1000', 'resi 1-10'],
        abbr: ['resident', 'residue', 'resid', 'i.'], regex: /[0-9,-]+/, map: listOrRangeMap,
        level: 'residue-test', property: B.ammp('auth_seq_id')
    },
    alt: {
        '@desc': 'alternate-conformation-identifier-list list of single letters',
        '@examples': ['alt A+B', 'alt ""', 'alt ""+A'],
        abbr: [], regex: /[a-zA-Z0-9'",]+/, map: listMap,
        level: 'atom-test', property: B.ammp('label_alt_id')
    },
    chain: {
        '@desc': 'chain-identifier-list list of single letters or sometimes numbers',
        '@examples': ['chain A'],
        abbr: ['c.'], regex: /[a-zA-Z0-9'",]+/, map: listMap,
        level: 'chain-test', property: B.ammp('auth_asym_id')
    },

};
