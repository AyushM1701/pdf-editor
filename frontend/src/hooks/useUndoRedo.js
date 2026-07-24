import { useReducer, useCallback } from 'react';

function undoRedoReducer(state, action) {
  switch (action.type) {
    case 'SET_STATE': {
      const nextState =
        typeof action.payload === 'function'
          ? action.payload(state.history[state.currentIndex])
          : action.payload;

      if (state.history[state.currentIndex] === nextState) {
        return state;
      }

      const nextHistory = [
        ...state.history.slice(0, state.currentIndex + 1),
        nextState,
      ].slice(-state.maxHistory);

      return {
        ...state,
        history: nextHistory,
        currentIndex: nextHistory.length - 1,
      };
    }
    case 'UNDO':
      return {
        ...state,
        currentIndex: Math.max(0, state.currentIndex - 1),
      };
    case 'REDO':
      return {
        ...state,
        currentIndex: Math.min(state.history.length - 1, state.currentIndex + 1),
      };
    case 'RESET':
      return {
        ...state,
        history: [action.payload],
        currentIndex: 0,
      };
    default:
      return state;
  }
}

export function useUndoRedo(initialState = [], maxHistory = 50) {
  const [state, dispatch] = useReducer(undoRedoReducer, {
    history: [initialState],
    currentIndex: 0,
    maxHistory,
  });

  const setState = useCallback(
    (newStateOrUpdater) => dispatch({ type: 'SET_STATE', payload: newStateOrUpdater }),
    [],
  );

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const resetState = useCallback(
    (newState) => dispatch({ type: 'RESET', payload: newState }),
    [],
  );

  return {
    state: state.history[state.currentIndex],
    setState,
    undo,
    redo,
    resetState,
    canUndo: state.currentIndex > 0,
    canRedo: state.currentIndex < state.history.length - 1,
  };
}
