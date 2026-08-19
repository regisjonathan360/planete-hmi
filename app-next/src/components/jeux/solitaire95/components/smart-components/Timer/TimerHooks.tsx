import { useState, useEffect } from "react";

export const useStartTimer = (
  gameStarted: boolean,
  gameFinished: boolean,
  intitialTime: number,
  saveScoreTimeCallback: (time: number) => void
): number => {
  const [time, setTime] = useState(intitialTime);

  useEffect(() => {
    setTime(intitialTime);
  }, [intitialTime]);

  useEffect(() => {
    if (!gameStarted || gameFinished) return undefined;
    const timeInterval = window.setInterval(() => {
      setTime((currentTime) => currentTime + 1);
    }, 1000);
    return () => window.clearInterval(timeInterval);
  }, [gameStarted, gameFinished]);

  useEffect(() => {
    if (gameFinished) saveScoreTimeCallback(time);
  }, [gameFinished, saveScoreTimeCallback, time]);

  useEffect(() => {
    if (!gameFinished && !gameStarted && intitialTime === 0) {
      setTime(0);
    }
  }, [gameStarted, gameFinished, intitialTime]);

  return time;
};

export const useSubstractPointsEveryTenSeconds = (
  score: number,
  time: number,
  substractFunction: (poinst: number) => void
): void => {
  useEffect(() => {
    if (score && time && time % 10 === 0) {
      substractFunction(-2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time]);
};
