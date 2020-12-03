type forEachCallbackFn = (value: any, key: any, map: any) => void
type reduceCallbackFn = (previousValue: any, currentValue: any, index: any, array: any[]) => any
type mapCallbackFn = (currentValue: any, index: any, array: any[]) => any

interface PivotGroup {

    toObject()              : any
    toArray()               : Array<any>
    size                    : number
    length                  : number
    has(key:any)            : boolean
    set(key:any, value:any) : this
    get(key:any)            : any
    any()                   : any
    map     (cb: mapCallbackFn,     thisArg?: any)      : Array<any>
    forEach (cb: forEachCallbackFn, thisArg?: any)      : void
    reduce  (cb: reduceCallbackFn,  initialValue?: any) : any
}

type PivotCallback = (group:PivotGroup, gropuName:string, measure?:string) => any;

interface CommonFunction {

    [key: string]: PivotCallback
}

interface GroupByDefinition {

    [key: string]: any
}

type GroupBy = string | number | boolean | PivotCallback | GroupByDefinition





class PivotMap extends Map implements PivotGroup {

    constructor() {

        super()
    }

    toObject(): any {

        let obj: any = {}
        this.forEach((i, key) => obj[key] = i)
        return obj;
    }

    toArray(): Array<any> {

        return [...this.values()]
    }

    any(): any {

        return this.get([...this.keys()][0])
    }

    get length(): number {

        return this.size;
    }

    map(cb: mapCallbackFn, thisArg?: any): any {

        return this.toArray().map(cb, thisArg)
    }

    reduce(cb: reduceCallbackFn, ...rest: any[]): any {

        if (arguments.length > 1) {

            return this.toArray().reduce(cb, rest[0])
        }

        return this.toArray().reduce(cb)
    }
}





class PivotArray extends Array<any> implements PivotGroup {

    constructor() {

        super()
    }

    toObject() {

        return this.reduce((acc,i,index) => { acc[index] = i; return acc }, {})
    }

    toArray() {

        return this;
    }

    get size() {

        return this.length;
    }

    has(key: any) {

        return this.includes(key)
    }

    set(key: any, value: any) {

        this.push(value)
        return this
    }

    get(key: any) {

        return this[key]
    }

    any() {

        return this[0]
    }
}





const commonFunctions : CommonFunction = {

    'sum'       : (group: PivotGroup, _: string, measure?: string) => measure && group.toArray().reduce((acc,i) => acc + i[measure], typeof group.any()[measure] === 'string' ? "" : 0),
    'count'     : (group: PivotGroup) => group.size,
    'pick_any'  : (group: PivotGroup) => group.any(),
    'toObject'  : (group: PivotGroup) => group.toObject()
}





function pivot_aggregate(arr:Array<any>, getKey: (data: any) => string, proto: any, ...next: any[]) {

    let bucket = new PivotMap();

    arr.forEach(i => {

        let k = getKey(i)
        if (!bucket.has(k)) bucket.set(k, new PivotArray());
        bucket.get(k).push(i)
    })

    if (next.length > 0) {

        bucket.forEach((data, group, theMap) => {

            theMap.set(group, pivot_parse(data, ...next))
        })
    }

    if (proto && typeof proto === 'string' && commonFunctions[proto]) {

        proto = commonFunctions[proto]
    }

    if (proto && typeof proto === 'function') {

        bucket.forEach((data, group, theMap) => {

            theMap.set(group, proto(data, group))
        })
    }

    if (proto && typeof proto === 'object') {

        bucket.forEach((data, group, theMap) => {

            let item = Object.assign({}, proto)

            Object
                .keys(proto)
                .forEach(measure => {

                    let cb = proto[measure]

                    if (typeof cb === 'string' && commonFunctions[cb]) {

                        cb = commonFunctions[cb]
                    }

                    if (typeof cb === 'function') {

                        item[measure] = cb(data, group, measure)
                    }
            })

            theMap.set(group, item)
        })
    }

    return bucket
}





function pivot_parse(arr:Array<any>, ...protos: any[]) {

    let proto = protos.shift();
    let buckets = []

    switch (typeof proto) {

        case 'function':
            buckets.push([proto, undefined])
            break

        case 'string':
            buckets.push([(i:any) => i[proto], undefined]);
            break

        case 'object':
            if (proto instanceof Map) {

                [...proto.keys()].forEach(k => buckets.push([ typeof k === 'function' ? k : (i:any) => i[k], proto.get(k)]))
            }
            else {

                Object.keys(proto).forEach(k => buckets.push([(i:any) => i[k], proto[k]]))
            }
            break;

        default:
            throw `PIVOT: unsupported group by key: ${proto}`
    }

    return buckets
        .map(b => pivot_aggregate(arr, b[0], b[1], ...protos))
        .reduce((acc, i) => {

            i.forEach((data, group) => acc.set(group, data))
            return acc;
        })
}





export function pivot(inputArray:Array<any>, ...groupBy: GroupBy[]) {

    groupBy = groupBy.filter(i => i || i === 0 || i === false).filter(i => typeof i !== 'object' || (i instanceof Map && i.size > 0) || Object.keys(i).length > 0 )

    if (groupBy.length < 1) {

        throw 'PIVOT: please provide at least 1 valid property name for grouping';
    }

    if (!Array.isArray(inputArray)) {

        inputArray = [inputArray];
    }

    return pivot_parse(inputArray, ...groupBy);
}





export function groupBy(key_function: (i: any) => any, value_descriptor: any): Map<(i: any) => any, any> {

    let m = new Map()
        m.set(key_function, value_descriptor)

    return m
}