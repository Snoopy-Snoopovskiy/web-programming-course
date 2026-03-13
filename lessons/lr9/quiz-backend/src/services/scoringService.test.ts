import { ScoringService } from "./scoringService.js";
const scoring = new ScoringService();

// Все ответы правильные
const test1 = scoring.scoreMultipleSelect(["a", "b", "c"], ["a", "b", "c"]);
console.assert(test1 === 3, `Test 1 failed: expected 3, got ${test1}`);

// Все ответы неправильные
const test2 = scoring.scoreMultipleSelect(["a", "b"], ["c", "d", "e"]);
console.assert(test2 === 0, `Test 2 failed: expected 0, got ${test2}`);

// Частично правильные
const test3 = scoring.scoreMultipleSelect(["a", "b", "c"], ["a", "d"]);
console.assert(test3 === 0.5, `Test 3 failed: expected 0.5, got ${test3}`);

// Пустой ответ студента
const test4 = scoring.scoreMultipleSelect(["a", "b"], []);
console.assert(test4 === 0, `Test 4 failed: expected 0, got ${test4}`);

// Один правильный, много неправильных — не уходит в минус
const test5 = scoring.scoreMultipleSelect(["a"], ["a", "b", "c", "d"]);
console.assert(test5 === 0, `Test 5 failed: expected 0, got ${test5}`);

const rubric = [
  { criterion: "structure", maxPoints: 3 },
  { criterion: "content", maxPoints: 5 },
  { criterion: "grammar", maxPoints: 2 },
];

// Полный балл
const test6 = scoring.scoreEssay(
  [{ criterion: "structure", points: 3 }, { criterion: "content", points: 5 }, { criterion: "grammar", points: 2 }],
  rubric
);
console.assert(test6 === 10, `Test 6 failed: expected 10, got ${test6}`);

// Частичный балл
const test7 = scoring.scoreEssay(
  [{ criterion: "structure", points: 2 }, { criterion: "content", points: 3 }],
  rubric
);
console.assert(test7 === 5, `Test 7 failed: expected 5, got ${test7}`);

// Балл превышает максимум — обрезается
const test8 = scoring.scoreEssay(
  [{ criterion: "content", points: 5 }],
  rubric
);
console.assert(test8 === 5, `Test 8 failed: expected 5, got ${test8}`);

// Несуществующий критерий — игнорируется
const test9 = scoring.scoreEssay(
  [{ criterion: "unknown", points: 5 }],
  rubric
);
console.assert(test9 === 0, `Test 9 failed: expected 0, got ${test9}`);

// Отрицательный балл — обрезается до 0
const test10 = scoring.scoreEssay(
  [{ criterion: "grammar", points: -1 }],
  rubric
);
console.assert(test10 === 0, `Test 10 failed: expected 0, got ${test10}`);

console.log("All tests passed!");