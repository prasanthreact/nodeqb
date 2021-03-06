import {
    columns,
    Condition,
    ExecInterface,
    mysqlCustomQueryCallback,
    NodeQBConnectionInterface,
    ReturnModeObjInterface,
} from './types';
import MysqlConnection from './database/mysql';
import mysql, {ConnectionConfig, PoolConfig} from 'mysql';
import {spaceRemover} from './helper';

const op = ['>', '<', '>=', '<=', '!=', '=', 'like'];

const connectionDB = {
    mysql: () => new MysqlConnection(),
};


const returnModeObj: ReturnModeObjInterface = {
    single: '_singleQuery',
    default: '_query',
    insert: '_insertQuery',
};

class NodeQB {
    private readonly _instance: MysqlConnection;
    private readonly _dbType: 'mysql';
    private readonly _config: ConnectionConfig & PoolConfig;
    private _prevent: boolean | undefined;

    constructor({type, defaults, config, method, prevent}: NodeQBConnectionInterface.ConstructorFunction) {
        this._dbType = type;
        this._config = config;
        this._prevent = prevent;
        if (typeof connectionDB[type] === 'undefined') {
            throw new Error(`Invalid type connection name ${type}`);
        }
        this._instance = connectionDB[type]();
        if (!prevent) {
            this._instance.getInstance(config, method, defaults);
        }
    }

    create = () => this._createNewInstance();
    format = (a: any, b: any) => {
        return this._instance.format(a, b)
    }

    escapeAll(a: any) {
        let res: any;
        if (a instanceof Object) {
            if (Array.isArray(a)) {
                res = a.map(val => mysql.escape(val))
            } else {
                res = Object.fromEntries(Object.entries(a).map((arr: any[]) => {
                    return this.escapeAll(arr)
                }))
            }
        } else {
            res = mysql.escape(a)
        }
        return res
    }

    get(callback?: mysqlCustomQueryCallback) {
        return this._exec({callback});
    }

    getColumns = (callback?: mysqlCustomQueryCallback) => {
        this._instance._sql = `SHOW COLUMNS FROM ${this._instance._table}`
        return this._exec({callback});
    }

    getAll(callback?: mysqlCustomQueryCallback) {
        return this._exec({callback});
    }

    async getForce(callback?: mysqlCustomQueryCallback) {
        const cols = await this.getColumns().then(a => a.map(({Field}) => Field))
        this._instance._sql = '';
        const sel = (<string>this._instance._select).split(',').map(i => i.trim()).filter(a => cols.indexOf(a) > -1)
        this.select(sel)
        return this._exec({callback})
    }

    async getForceSingle(callback?: mysqlCustomQueryCallback) {
        const cols = await this.getColumns().then(a => a.map(({Field}) => Field))
        this._instance._sql = '';
        const sel = (<string>this._instance._select).split(',').map(i => i.trim()).filter(a => cols.indexOf(a) > -1)
        this.select(sel)
        return this._exec({callback, returnMode: "single"})
    }

    async forceInsert(insertObject: object, callback?: mysqlCustomQueryCallback) {
        const cols = await this.getColumns().then(a => a.map(({Field}) => Field))
        this._instance._sql = '';
        const filteredObject = Object.fromEntries(Object.entries(insertObject).filter(([a]) => cols.indexOf(a) > -1));
        return this.insert(filteredObject, callback)
    }
    async forceUpdate(insertObject: object, callback?: mysqlCustomQueryCallback) {
        const cols = await this.getColumns().then(a => a.map(({Field}) => Field))
        this._instance._sql = '';
        const filteredObject = Object.fromEntries(Object.entries(insertObject).filter(([a]) => cols.indexOf(a) > -1))
       return this.update(filteredObject, callback)
    }

    count(callback?: mysqlCustomQueryCallback) {
        this._instance._select = ' count(*) as c ';
        return this._exec({callback, returnMode: 'single', value: 'c'});
    }

    value = (columName: string) => {
        this._instance._limit = 'limit 1';
        return this._exec({returnMode: 'single', value: columName});
    };

    pluck = (key: string, value?: string) => {
        if (!key) {
            return;
        }
        let keyName = key;
        let valueName = value ?? key;
        this._instance._select = ` ${keyName} as keyColumn, ${valueName} as valueColumn `;
        return this._exec({}).then((res) => {
            return res.reduce(
                (acc: any, {
                    keyColumn,
                    valueColumn
                }: { keyColumn: any; valueColumn: any }) => (acc[keyColumn] = valueColumn, acc), {});
        });
    };

    table(tableName: string): NodeQB {
        this._instance.init();
        this._instance._table = `${tableName}`;
        return this;
    }

    primary = () => this._instance.getPrimary();

    getQuery(): string {
        return spaceRemover(this._instance.getSql());
    }

    first(callback?: mysqlCustomQueryCallback) {
        this._instance._limit = 'limit 1';
        return this._exec({callback, returnMode: 'single'});
    }

    orderByAsc(...columns: Array<string> | any): NodeQB {
        this._order(columns, 'ASC');
        return this;
    }

    orderByDesc(...columns: Array<string> | any): NodeQB {
        this._order(columns, 'DESC');
        return this;
    }


    groupBy(...columns: Array<string> | any): NodeQB {
        this._instance._group = ` GROUP BY ${this._columnPrepare(columns)}`;
        return this;
    }

    oldest(...columns: Array<string>): NodeQB {
        this.orderByAsc(...columns);
        this._instance._limit = 'LIMIT 1';
        return this;
    }

    latest(...columns: Array<string>): NodeQB {
        this.orderByDesc(...columns);
        this._instance._limit = 'LIMIT 1';
        return this;
    }

    select(...columns: Array<string> | any): NodeQB {
        let select = '';
        if (columns[0]) {
            select = ' ' + this._columnPrepare(columns);
        }
        this._instance._select = select;
        return this;
    }

    selectRaw(str: string, values: any[] = []): NodeQB {
        this._instance._select = ` ${this.format(str, values)}`;
        return this;
    }

    raw(str: string, values: any[] = []): NodeQB {
        this._instance._sql = `${this.format(str, values)}`;
        return this;
    }

    whereRaw(str: string, values: any[] = []): NodeQB {
        this._instance._where = `WHERE ${this.format(str, values)}`;
        return this;
    }

    havingRaw(str: string, values: any[] = []): NodeQB {
        this._instance._having = `HAVING ${this.format(str, values)}`;
        return this;
    }

    orderByRaw(str: string, values: any[] = []): NodeQB {
        this._instance._order = `ORDER ${this.format(str, values)}`;
        return this;
    }

    groupByRaw(str: string, values: any[] = []): NodeQB {
        this._instance._order = `GROUP BY ${this.format(str, values)}`;
        return this;
    }

    addSelect(str: string): NodeQB {
        this._instance._select += `,${str}`;
        return this;
    }

    async max(column: string) {
        return await this.select(` max(${column}) as m`).value('m');
    }

    async min(column: string) {
        return await this.select(` min(${column}) as m`).value('m');
    }

    async sum(column: string) {
        return await this.select(` sum(${column}) as s`).value('s');
    }

    avg(...columns: Array<string> | any) {
        let col = columns.flat().join('+');
        this._instance._select = ` avg(${col}) as av`;
        return this._exec({returnMode: 'single', value: 'av'});
    }

    where(...columns: any[]) {
        return columns.length === 0 ? this : this._conditionCallback(columns.flat(), 'AND');
    }

    orWhere(...columns: any[]) {
        return columns.length === 0 ? this : this._conditionCallback(columns.flat(), 'OR');
    }

    having(...columns: any[]) {
        return columns.length === 0 ? this : this._conditionCallback(columns.flat(), 'AND', '_having', '_having');
    }

    orHaving(...columns: any[]) {
        return columns.length === 0 ? this : this._conditionCallback(columns.flat(), 'OR', '_having', '_having');
    }

    whereColumn(...columns: any[]) {
        return this.where(...columns);
    }

    whereDate(column: string, value: string | number): NodeQB {
        this._instance._where += ` DATE(${column})= ${this._instance._escape(value)}`;
        return this;
    }

    whereDay(column: string, value: string | number): NodeQB {
        this._instance._where += ` DAY(${column})= ${this._instance._escape(value)}`;
        return this;
    }

    whereTime(column: string, value: string | number): NodeQB {
        this._instance._where += ` TIME(${column})= ${this._instance._escape(value)}`;
        return this;
    }

    whereYear(column: string, value: string | number): NodeQB {
        this._instance._where += ` YEAR(${column})= ${this._instance._escape(value)}`;
        return this;
    }

    whereMonth(column: string, value: string | number): NodeQB {
        this._instance._where += ` MONTH(${column})= ${this._instance._escape(value)}`;
        return this;
    }

    whereNotNull(column: string): NodeQB {
        this._instance._where += `${column} IS NOT NULL`;
        return this;
    }

    whereNull(column: string): NodeQB {
        this._instance._where += `${column} IS NULL`;
        return this;
    }

    whereAnd = () => {
        this._instance._where += ` AND `;
        return this;
    };

    whereOR = () => {
        this._instance._where += ` OR `;
        return this;
    };

    async exists(): Promise<boolean> {
        this.limit(1);
        return (await this.count()) > 0;
    }

    async doesntExist(): Promise<boolean> {
        this.limit(1);
        return (await this.count()) === 0;
    }

    whereExists(...columns: any[]) {
        if (typeof columns[0] !== 'undefined') {
            this._instance._where = 'EXISTS ';
            return this._conditionCallback(columns.flat(), 'AND', '_sql', '_where');
        } else {
            return this;
        }
    }

    whereIn(column: string, values: any[] | string = []): NodeQB {
        return this._in(column, values, 'AND');
    }

    orWhereIn(column: string, values: any[] | string = []): NodeQB {
        return this._in(column, values, 'OR');
    }

    whereNotIn(column: string, values: any[] | string = []): NodeQB {
        return this._in(column, values, 'AND', 'NOT');
    }

    orWhereNotIn(column: string, values: any[] | string = []): NodeQB {
        return this._in(column, values, 'OR', 'NOT');
    }

    limit(number: number): NodeQB {
        this._instance._limit = `LIMIT ${this._instance._escape(number)}`;
        return this;
    }

    offset(number: number): NodeQB {
        this._instance._offset = `OFFSET ${this._instance._escape(number)}`;
        return this;
    }

    insert(insertObject: object, callback?: mysqlCustomQueryCallback) {
        this._instance._insert = this._conditionPrepare([insertObject], ',');
        return this._exec({callback});
    }

    insertGetId(insertObject: object, callback?: mysqlCustomQueryCallback) {
        this._instance._insert = this._conditionPrepare([insertObject], ',');
        return this._exec({callback, value: 'insertId', returnMode: 'insert'});
    }

    update(updateObject: object, callback?: mysqlCustomQueryCallback) {
        this._instance._update = this._conditionPrepare([updateObject], ',');
        return this._exec({callback});
    }

    delete(callback?: mysqlCustomQueryCallback) {
        this._instance._delete = 'DELETE';
        return this._exec({callback});
    }

    distinct(column: string): NodeQB {
        this.select(`DISTINCT ${column}`);
        return this;
    }

    truncate(callback?: mysqlCustomQueryCallback) {
        this._instance._sql = `TRUNCATE TABLE ${this._instance._table};`;
        return this._exec({callback, returnMode: 'insert'});
    }

    drop(callback?: mysqlCustomQueryCallback) {
        this._instance._sql = `DROP TABLE ${this._instance._table};`;
        return this._exec({callback, returnMode: 'insert'});
    }

    onJoin(...values: any[]) {
        this._instance._join += ` ON ${this._conditionPrepare(values.flat())}`;
        return this;
    }

    orJoin(...values: any[]) {
        this._instance._join += ` OR ${this._conditionPrepare(values.flat())}`;
        return this;
    }

    andJoin(...values: any[]) {
        this._instance._join += ` AND ${this._conditionPrepare(values.flat())}`;
        return this;
    }

    join: NodeQBConnectionInterface.Join = (...props): NodeQB => {
        return this._joinPrepare(...props);
    };

    leftJoin: NodeQBConnectionInterface.Join = (...props): NodeQB => {
        props.push('mode', 'LEFT JOIN');
        return this._joinPrepare(...props);
    };

    righJoin: NodeQBConnectionInterface.Join = (...props): NodeQB => {
        props.push('mode', 'RIGHT JOIN');
        return this._joinPrepare(...props);
    };

    skip(number: number): NodeQB {
        this.offset(number);
        return this;
    }

    take(number: number): NodeQB {
        this.limit(number);
        return this;
    }

    union(query: InstanceType<any>): NodeQB {
        let q = query;
        if ('getQuery' in query) {
            q = query.getQuery();
        }
        this._instance._union = `UNION ${q}`;
        return this;
    }

    private _createNewInstance() {
        return new NodeQB({type: this._dbType, config: this._config, prevent: true});
    }

    private async _exec(props: ExecInterface) {
        const {callback, returnMode = 'default', value} = props;

        this._instance._queryOptionsBuild();
        const queryMode = returnModeObj[returnMode];
        if (callback) {
            return this._instance[queryMode].apply(this._instance, [{
                options: this._instance._queryOptions,
                callback,
                value
            }]);
        } else {
            return this._instance[queryMode].apply(this._instance, [{
                options: this._instance._queryOptions,
                callback,
                value,
            }])
        }

    }

    private _columnPrepare = (columns: any[]) => {
        if (typeof columns !== 'undefined' && Array.isArray(columns)) {
            return columns.flat().join(', ');
        }
        return '';
    };

    private _order(columns: Array<string> | any, sort: 'ASC' | 'DESC'): NodeQB {
        let col: string = '';
        if (typeof columns !== 'undefined' && columns[0]) {
            col = `ORDER BY  ${this._columnPrepare(columns)} ${sort}`;
        } else {
            let orderColumn = this._instance._defaults?.orderColumn;
            if (orderColumn) {
                col = `ORDER BY  ${this._columnPrepare([orderColumn])} ${sort}`;
            }
        }
        this._instance._order = col;
        return this;
    }

    private _objectPrepare(columns: any) {
        if (typeof columns !== 'undefined' && Array.isArray(columns)) {
            const [k, v] = columns;
            let kn = op.some((a) => k.indexOf(a) > -1) ? k.replace(/(\w+)(.*)/g, '`$1` $2') : `\`${k}\` =`;
            let vn = typeof v === 'string' ? `${this._instance._escape(v)}` : this._instance._escape(v);
            return [kn, vn].join(' ');
        }
        return '';
    }

    private _whereArrayPrepare(columns: any): string {
        let [column, secArg, thirdArg] = columns;
        let str: string = '';
        column = this._prepareKey(column);
        thirdArg = this._prepareValue(thirdArg);
        if (op.some((a) => a === secArg)) {
            str = [column, secArg, thirdArg].join(' ');
        } else {
            secArg = this._prepareValue(secArg);
            str = [column, secArg].join(' = ');
        }
        return str;
    }

    private _prepareValue = (val: any) => typeof val === 'string' ? `${this._instance._escape(val)}` : val;

    private _prepareKey = (col: any) => `\`${col}\``;

    private _conditionPrepare(columns: columns, sepreator: string = 'AND') {
        let str: string = '';
        if (typeof columns[0] === 'object') {
            let col = columns.flat();
            str = Object.entries(col[0])
                .map((a) => this._objectPrepare(a))
                .join(` ${sepreator} `);
        } else {
            str = this._whereArrayPrepare(columns.flat());
        }
        return `${str}`;
    }

    private _conditionCallback(
        columns: columns,
        cond: Condition,
        getVar: keyof MysqlConnection = '_where',
        setVar: keyof MysqlConnection = '_where',
    ) {
        let whereQuery = '';
        let connWord = !this._prevent && this._instance[getVar] ? cond : '';
        if (columns[0] instanceof Function) {
            const newInstance = this._createNewInstance();
            const fun = columns[0](newInstance);
            newInstance._instance._generateSql();
            const str = typeof fun == 'object' ? (fun?._instance ? fun._instance[getVar] : fun) : fun;
            const callbackQuery = `( ${str} )`;
            connWord = this._instance[getVar] ? cond : '';
            whereQuery += ` ${callbackQuery} `;
        } else {
            this._prevent = false;
            whereQuery += this._conditionPrepare(columns);
        }
        this._instance[setVar] += ` ${connWord} ${whereQuery}`;
        return this;
    }

    private _in(column: string, values: any[] | string = [], cond: Condition, mode: string = ''): NodeQB {
        let val = Array.isArray(values) ? this.escapeAll(values).join(',') : this._instance._escape(values);
        const condWord = this._instance._where ? cond : '';
        this._instance._where += ` ${condWord} ${column} ${mode} IN (${val})`;
        return this;
    }

    private _joinPrepare: NodeQBConnectionInterface.Join = (
        joinTable,
        idOrFun,
        condition,
        secondaryId,
        mode = 'INNER JOIN',
    ): NodeQB => {
        let str = '';
        if (idOrFun instanceof Function) {
            const fun = idOrFun(this._createNewInstance());
            if ('_instance' in fun) {
                str = fun._instance._join;
            }
        } else {
            str = `ON ${idOrFun} ${condition} ${secondaryId} `;
        }
        this._instance._join += ` ${mode} ${joinTable} ${str}`;
        return this;
    };
}

export = NodeQB
