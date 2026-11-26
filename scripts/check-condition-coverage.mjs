// 条件網羅（C2）の確認。`vitest run --coverage` が出す coverage/coverage-final.json を読む。
//
// istanbul の分岐（C1）は if・三項演算子の真偽と、&& / || / ?? の各項が「評価されたか」までしか見ない。
// ここでは各項が条件として「真と偽（?? は null/undefined とそれ以外）の両方になったか」を確かめる。
//
// 各項の真偽は評価回数から求める（istanbul は && / || の真偽そのものを集計結果に残さないため）。
//   L && R … R が評価された回数 = L が真だった回数、残りが偽
//   L || R … R が評価された回数 = L が偽だった回数、残りが真
//   L ?? R … R が評価された回数 = L が null/undefined だった回数、残りがそれ以外
// いちばん右の項は値として使われることが多い（a || 'fallback'、cond && <JSX />）ので、
// 式全体が if / 三項演算子の条件になっているときだけ、その真偽の回数から求めて確かめる。
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { parse } from '@babel/parser';

const file = process.argv[2] ?? 'coverage/coverage-final.json';
const coverage = JSON.parse(readFileSync(file, 'utf8'));

const key = (loc) => `${loc.start.line}:${loc.start.column}`;

/** 子ノードを順にたどる */
const walk = (node, visit, parent = null) => {
  if (!node || typeof node.type !== 'string') {
    return;
  }
  visit(node, parent);
  for (const [k, v] of Object.entries(node)) {
    if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments') {
      continue;
    }
    for (const child of Array.isArray(v) ? v : [v]) {
      if (child && typeof child.type === 'string') {
        walk(child, visit, node);
      }
    }
  }
};

/** istanbul と同じ順に、論理式の葉（&& / || / ?? でない項）を並べる */
const leaves = (node) =>
  node.type === 'LogicalExpression'
    ? [...leaves(node.left), ...leaves(node.right)]
    : [node];

const problems = [];

for (const [path, fc] of Object.entries(coverage)) {
  const rel = relative(process.cwd(), path);
  const code = readFileSync(path, 'utf8');
  const ast = parse(code, {
    sourceType: 'module',
    plugins: /\.tsx?$/.test(path) ? ['typescript', 'jsx'] : ['jsx'],
    errorRecovery: true,
  });

  // 開始位置 → 分岐（binary-expr: 論理式、if / cond-expr: その真偽の回数）
  const branches = new Map();
  for (const [id, b] of Object.entries(fc.branchMap)) {
    branches.set(`${b.type}@${key(b.loc)}`, { ...b, counts: fc.b[id] });
  }

  // 論理式 → それを条件とする if / 三項演算子の [真, 偽] の回数
  const decisions = new Map();
  const record = (test, counts) => {
    let t = test;
    let flip = false;
    while (t.type === 'UnaryExpression' && t.operator === '!') {
      t = t.argument;
      flip = !flip;
    }
    if (t.type !== 'LogicalExpression') {
      return;
    }
    if (!counts) {
      problems.push(
        `${rel}:${test.loc.start.line} 条件分岐の集計が見つかりません`,
      );
      return;
    }
    decisions.set(t, flip ? [counts[1], counts[0]] : counts);
  };

  const roots = [];
  walk(ast.program, (node, parent) => {
    if (node.type === 'IfStatement') {
      record(node.test, branches.get(`if@${key(node.loc)}`)?.counts);
    }
    if (node.type === 'ConditionalExpression') {
      record(node.test, branches.get(`cond-expr@${key(node.loc)}`)?.counts);
    }
    if (
      node.type === 'LogicalExpression' &&
      parent?.type !== 'LogicalExpression'
    ) {
      roots.push(node);
    }
  });

  // ソースマップを通した位置は、行頭やかっこの直後で1つ手前のトークンにずれることがある。
  // 式全体の開始位置で見つからなければ、項の開始位置がいちばん多く一致する集計を使う
  const logical = [...branches.values()].filter(
    (b) => b.type === 'binary-expr',
  );
  const findBranch = (root, ls) => {
    const exact = branches.get(`binary-expr@${key(root.loc)}`);
    if (exact && exact.locations.length === ls.length) {
      return exact;
    }
    let best = null;
    let bestScore = 0;
    for (const b of logical) {
      if (b.locations.length !== ls.length) {
        continue;
      }
      const score = b.locations.filter(
        (l, i) => key(l) === key(ls[i].loc),
      ).length;
      if (score > bestScore) {
        best = b;
        bestScore = score;
      }
    }
    return bestScore >= Math.max(1, ls.length - 1) ? best : null;
  };

  for (const root of roots) {
    const ls = leaves(root);
    const b = findBranch(root, ls);
    if (!b) {
      problems.push(
        `${rel}:${root.loc.start.line} 論理式の集計が見つかりません`,
      );
      continue;
    }
    const evals = new Map(ls.map((leaf, i) => [leaf, b.counts[i]]));
    /** 部分式が評価された回数（最初の葉が評価された回数と同じ） */
    const evaluated = (node) => evals.get(leaves(node)[0]);

    const report = (node, outcome) => {
      const text = code.slice(node.start, node.end).replace(/\s+/g, ' ');
      problems.push(
        `${rel}:${node.loc.start.line}:${node.loc.start.column + 1} 「${text}」が${outcome}になるテストがありません`,
      );
    };

    /** 部分式の [真, 偽] の回数が分かれば確かめ、子に下ろす */
    const check = (node, outcome) => {
      if (node.type !== 'LogicalExpression') {
        if (outcome) {
          const [t, f] = outcome;
          if (node.__nullish) {
            if (t === 0) {
              report(node, 'null/undefined 以外');
            }
            if (f === 0) {
              report(node, 'null/undefined');
            }
          } else {
            if (t === 0) {
              report(node, '真');
            }
            if (f === 0) {
              report(node, '偽');
            }
          }
        }
        return;
      }
      const { left, right, operator } = node;
      const all = evaluated(left);
      const rightRuns = evaluated(right);
      let leftOutcome;
      let rightOutcome = null;
      if (operator === '&&') {
        leftOutcome = [rightRuns, all - rightRuns];
        // 全体が偽 = 左が偽 + 右が偽
        if (outcome) {
          rightOutcome = [outcome[0], outcome[1] - leftOutcome[1]];
        }
      } else if (operator === '||') {
        leftOutcome = [all - rightRuns, rightRuns];
        // 全体が真 = 左が真 + 右が真
        if (outcome) {
          rightOutcome = [outcome[0] - leftOutcome[0], outcome[1]];
        }
      } else {
        // ?? は「null/undefined 以外」を真として扱う
        // 左が論理式なら「真偽」ではなく「null かどうか」なので、ここでは下ろさない
        leftOutcome =
          left.type === 'LogicalExpression'
            ? null
            : [all - rightRuns, rightRuns];
        left.__nullish = true;
      }
      check(left, leftOutcome);
      check(right, rightOutcome);
    };

    check(root, decisions.get(root) ?? null);
  }
}

if (problems.length > 0) {
  console.error(
    `条件網羅（C2）を満たしていない条件が ${problems.length} 件あります`,
  );
  for (const p of problems) {
    console.error(`  ${p}`);
  }
  process.exit(1);
}
console.log('条件網羅（C2）: すべての条件が真・偽の両方になっています');
