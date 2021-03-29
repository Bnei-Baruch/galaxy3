import React from "react";
import ReactDOM from "react-dom";
import {Stats} from "./MonitoringData";

const mean = (numbers) => {
  const sum = numbers.reduce((s, n) => {
    return s + n;
  }, 0);
  return sum / numbers.length;
};

const dSquared = (numbers) => {
  const meanLocal = mean(numbers);
  const sum = numbers.reduce((s, n) => {
    return s + (n - meanLocal) * (n - meanLocal);
  }, 0);
  return sum / numbers.length;
};

it("Stats tests", () => {
  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  expect(5.5).toBe(mean(numbers));
  expect(8.25).toBe(dSquared(numbers));

  const s = new Stats();
  let i = 1;
  while (i <= numbers.length) {
    s.add(numbers[i - 1], 0);
    const subNumbers = numbers.slice(0, i);
    console.log(
      `Numbers ${subNumbers}. Mean: ${mean(subNumbers)} ${s.mean}, DSquared: ${dSquared(subNumbers)} ${s.dSquared}.`
    );
    expect(mean(subNumbers)).toBe(s.mean);
    expect(dSquared(subNumbers)).toBe(s.dSquared);
    i++;
  }

  i = 0;
  while (i < numbers.length - 1) {
    s.remove(numbers[i], 0);
    const subNumbers = numbers.slice(i + 1);
    console.log(
      `Numbers ${subNumbers}. Mean: ${mean(subNumbers)} ${s.mean}, DSquared: ${dSquared(subNumbers)} ${s.dSquared}.`
    );
    expect(mean(subNumbers)).toBe(s.mean);
    expect(dSquared(subNumbers)).toBe(s.dSquared);
    i++;
  }

  // Empty list should actually be NaN, but due to serialization we
  // will work with 0.0
  s.remove(numbers[numbers.length - 1], 0);
  expect(0).toBe(s.mean);
  expect(0).toBe(s.dSquared);
});
