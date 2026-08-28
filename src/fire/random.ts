/** 実際に抽選する範囲と、その値として許される範囲。 */
type RandomNumberGeneratorOptions = {
  /** 結果として許される最小値。抽選の始点ではない。下限がなければ省略する。 */
  rangeMin?: number;

  /** 結果として許される最大値。rangeMin以上にし、上限がなければ省略する。 */
  rangeMax?: number;

  /** 実際に抽選を始める値。この値を含む。 */
  startValue: number;

  /** 実際に抽選する幅。0以上。0なら毎回startValueを返し、終点は含まない。 */
  addRange: number;
};

/**
 * startValue以上、startValue + addRange未満を抽選する関数を作る。
 * 抽選結果がrangeMin〜rangeMaxを越えた場合だけ、許される端の値へ収める。
 * 引数の大小関係は検査しない。
 */
export function createRandomNumberGenerator({
  rangeMin,
  rangeMax,
  startValue,
  addRange,
}: RandomNumberGeneratorOptions) {
  const minimum = rangeMin ?? Number.NEGATIVE_INFINITY;
  const maximum = rangeMax ?? Number.POSITIVE_INFINITY;
  return () => Math.min(Math.max(startValue + Math.random() * addRange, minimum), maximum);
}
