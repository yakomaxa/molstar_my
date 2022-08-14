/**
 * Copyright (c) 2017-2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author Panagiotis Tourlas <panagiot_tourlov@hotmail.com>
 * @author Koya Sakuma
 * This module is based on jmol tranpiler from MolQL and modified in similar manner as pymol and vmd tranpilers.
 **/


import * as P from '../../../mol-util/monadic-parser';
import * as h from '../helper';
import { MolScriptBuilder } from '../../../mol-script/language/builder';
const B = MolScriptBuilder;
import { properties } from './properties';
import { special_properties } from './special_properties';
import { special_keywords } from './special_keywords';
import { special_operators } from './special_operators';
import { operators } from './operators';
import { keywords } from './keywords';
import { AtomGroupArgs } from '../types';
import { Transpiler } from '../transpiler';
//import { OperatorList } from '../types';

// const propertiesDict = h.getPropertyRules(properties);

// const slash = P.MonadicParser.string('/');

const propertiesDict = h.getPropertyRules(special_properties);

//const slash = P.MonadicParser.string('/');
const dot = P.MonadicParser.string('.');
const colon = P.MonadicParser.string(':');
//const comma = P.MonadicParser.string(',');
const star = P.MonadicParser.string('*');
const bra = P.MonadicParser.string('(');
const ket = P.MonadicParser.string(')');


/* is Parser -> MonadicParser substitution correct? */
function orNull(rule: P.MonadicParser<any>) {
    return rule.or(P.MonadicParser.of(null));
}


function atomSelectionQuery2(x: any) {
    const tests: AtomGroupArgs = {};
    const props: { [k: string]: any[] } = {};

    for (const k in x) {
        const ps = special_properties[k];
        if (!ps) {
            throw new Error(`property '${k}' not supported, value '${x[k]}'`);
        }
        if (x[k] === null) continue;
        if (!props[ps.level]) props[ps.level] = [];
        props[ps.level].push(x[k]);
    }

    for (const p in props) {
        tests[p] = h.andExpr(props[p]);
    }

    return B.struct.generator.atomGroups(tests);
}


const lang = P.MonadicParser.createLanguage({

    Parens: function (r: any) {
        return P.MonadicParser.alt(
            r.Parens,
            r.Operator,
            r.Expression
        ).wrap(P.MonadicParser.string('['), P.MonadicParser.string(']'));
    },

    Expression: function (r: any) {
        return P.MonadicParser.alt(
	    // order matters
	    r.Keywords,
	    r.NamedAtomProperties,
	    r.AtomSelectionMacro.map(atomSelectionQuery2),
	    r.Object
        );
    },


    //    lys:a.ca  -> resn lys and chain A and name ca
    //    lys*a.ca  -> resn lys and chain A and name ca
    //
    //    :a.ca -> chain A and name ca
    //    *a.ca -> chain A and name ca
    //
    //    *.cg -> name ca
    //    :.cg -> name ca
    AtomSelectionMacro: function (r: any) {
        return P.MonadicParser.alt(
	    // :A.CA :.CA :A
            colon.then(P.MonadicParser.alt(
                P.MonadicParser.seq(                
                    orNull(propertiesDict.chain).skip(dot),
                    orNull(propertiesDict.name)
                ).map(x => { return { chain: x[0], name: x[1]}; }),
                P.MonadicParser.seq(
                    orNull(propertiesDict.name).skip(dot)
                ).map(x => { return {name: x[0] }; }),
		P.MonadicParser.seq(
                    orNull(propertiesDict.chain)
                ).map(x => { return {chain: x[0] }; }),
            )),
	    // *A.CA *.CA
	    star.then(P.MonadicParser.alt(
                P.MonadicParser.seq(                
                    orNull(propertiesDict.chain).skip(dot),
                    orNull(propertiesDict.name)
                ).map(x => { return { chain: x[0], name: x[1]}; }),
                P.MonadicParser.seq(
                    orNull(propertiesDict.name).skip(dot)
                ).map(x => { return {name: x[0] }; }),
		P.MonadicParser.seq(
                    orNull(propertiesDict.chain)
                ).map(x => { return {chain: x[0] }; }),
            )),
	    // 1-100,201
	    bra.then(P.MonadicParser.alt(
		P.MonadicParser.alt(
		    P.MonadicParser.seq(
			propertiesDict.resi.skip(ket),
		    ).map(x => {
			return { resi: x[0] }		
			;})
		)
	    )),
	    //  lys:a.ca lys:a lys lys.ca
	    P.MonadicParser.alt(
		P.MonadicParser.alt(
                    P.MonadicParser.seq(
			orNull(propertiesDict.resn).skip(colon),
			orNull(propertiesDict.chain).skip(dot),
			orNull(propertiesDict.name)
                    ).map(x => { return { resn: x[0], chain: x[1], name: x[2] }; }),
		    P.MonadicParser.seq(
			orNull(propertiesDict.resn).skip(star),
			orNull(propertiesDict.chain).skip(dot),
			orNull(propertiesDict.name)
                    ).map(x => { return { resn: x[0], chain: x[1], name: x[2] }; }),
                    P.MonadicParser.seq(
			orNull(propertiesDict.resn).skip(colon),
			orNull(propertiesDict.chain),
                    ).map(x => { return { resn: x[0], chain: x[1] }; }),
		    P.MonadicParser.seq(
			orNull(propertiesDict.resn).skip(star),
			orNull(propertiesDict.chain),
                    ).map(x => { return { resn: x[0], chain: x[1] }; }),
		    P.MonadicParser.seq(
			orNull(propertiesDict.resn).skip(dot),
			orNull(propertiesDict.name),
                    ).map(x => { return { resn: x[0], name: x[1] }; }),
		    P.MonadicParser.seq(
			orNull(propertiesDict.resn),
		    ).map(x => {  return { resn: x[0] };}),
		)
	    )		  
	    
	)
		    
    },

    ObjectProperty: () => {
	const w = h.getReservedWords(special_properties, special_keywords, special_operators)
              .sort(h.strLenSortFn).map(h.escapeRegExp).join('|');
        return P.MonadicParser.regexp(new RegExp(`(?!(${w}))[A-Z0-9_]+`, 'i'));
    },

    ObjectProperty2: () => {
	const w = h.getReservedWords(properties, keywords, operators)
              .sort(h.strLenSortFn).map(h.escapeRegExp).join('|');
        return P.MonadicParser.regexp(new RegExp(`(?!(${w}))[A-Z0-9_]+`, 'i'));
    },
    
    Object: (r: any) => {
        return r.ObjectProperty2
            .map((x: any) => { throw new Error(`property 'object' not supported, value '${x}'`); });
    },

    NamedAtomProperties: function () {
        return P.MonadicParser.alt(...h.getNamedPropertyRules(properties));
    },

    Operator: function (r: any) {
        return h.combineOperators(operators, P.MonadicParser.alt(r.Parens, r.Expression, r.Operator));
    },


    Keywords: () => P.MonadicParser.alt(...h.getKeywordRules(keywords)),

    Query: function (r: any) {
        return P.MonadicParser.alt(
            r.Operator,
            r.Parens,
            r.Expression
        ).trim(P.MonadicParser.optWhitespace);
    }
    
});

export const transpiler: Transpiler = str => lang.Query.tryParse(str);
