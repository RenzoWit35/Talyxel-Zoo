import { describe, expect, it } from 'vitest';
import { clampedTranslate, formatArea, formatDuration, labelPoint, lineMidpoint, pointInPolygon, polygonArea, polygonPerimeter, polylineLength, walkMinutes, type Point } from '../shared/geometry';

const square: Point[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

// A "U" shape whose centroid falls in the gap between the arms.
const ushape: Point[] = [
  [0, 0],
  [3, 0],
  [3, 8],
  [7, 8],
  [7, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];

describe('geometry', () => {
  it('computes area regardless of winding order', () => {
    expect(polygonArea(square)).toBe(100);
    expect(polygonArea([...square].reverse())).toBe(100);
  });

  it('computes perimeter', () => {
    expect(polygonPerimeter(square)).toBe(40);
  });

  it('tests point containment', () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([15, 5], square)).toBe(false);
    expect(pointInPolygon([5, 4], ushape)).toBe(false);
  });

  it('places labels inside concave shapes', () => {
    expect(labelPoint(square)).toEqual([5, 5]);
    expect(pointInPolygon(labelPoint(ushape), ushape)).toBe(true);
  });

  it('keeps translated shapes on the map', () => {
    const moved = clampedTranslate(square, 95, -20, 100, 100);
    expect(moved[0]).toEqual([90, 0]);
    expect(moved[2]).toEqual([100, 10]);
  });

  it('formats areas in m² and hectares', () => {
    expect(formatArea(1234.4)).toBe('1,234 m²');
    expect(formatArea(25_000)).toBe('2.5 ha');
  });

  it('measures open lines (walk routes) without closing them', () => {
    expect(polylineLength([[0, 0], [3, 4], [3, 10]])).toBe(11);
    expect(polylineLength([[0, 0]])).toBe(0);
  });

  it('estimates walking time at 4 km/h and formats durations', () => {
    expect(walkMinutes(1000)).toBe(15);
    expect(formatDuration(0.4)).toBe('< 1 min');
    expect(formatDuration(15)).toBe('15 min');
    expect(formatDuration(75)).toBe('1 h 15 min');
  });

  it('finds the halfway point along a line', () => {
    expect(lineMidpoint([[0, 0], [10, 0], [10, 10]])).toEqual({ point: [10, 0], angle: 0 });
    expect(lineMidpoint([[0, 0], [0, 20]]).point).toEqual([0, 10]);
  });
});
