import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

export const FAVORITES_KEY = "nyumbadirect_favorites";

function currentFavoritesKey() {
  const userId = localStorage.getItem("user_id");
  return localStorage.getItem("access_token") && userId
    ? `${FAVORITES_KEY}:${userId}`
    : FAVORITES_KEY;
}

function readLocalFavorites(key = currentFavoritesKey()) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || "[]");
    return [...new Set(values.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  } catch {
    return [];
  }
}

function remoteIds(items) {
  return [...new Set((items || []).map((favorite) => Number(favorite.property_id)).filter((id) => Number.isInteger(id) && id > 0))];
}

export default function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState(readLocalFavorites);
  const favoriteIdsRef = useRef(favoriteIds);
  const [error, setError] = useState("");

  const updateFavorites = useCallback((ids) => {
    const normalized = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    favoriteIdsRef.current = normalized;
    setFavoriteIds(normalized);
    try {
      localStorage.setItem(currentFavoritesKey(), JSON.stringify(normalized));
    } catch (storageError) {
      console.warn("Unable to cache saved homes locally:", storageError);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem("access_token")) return undefined;

    const syncFavorites = async () => {
      try {
        const initialResponse = await api.get("/favorites");
        const initialIds = remoteIds(initialResponse.data);
        const knownIds = new Set(initialIds);
        const localIds = [...new Set([
          ...readLocalFavorites(FAVORITES_KEY),
          ...readLocalFavorites(currentFavoritesKey()),
        ])];
        const localOnlyIds = localIds.filter((id) => !knownIds.has(id));

        const imports = await Promise.allSettled(
          localOnlyIds.map((id) => api.post(`/favorites/${id}`))
        );
        const finalResponse = await api.get("/favorites");
        const mergedIds = remoteIds(finalResponse.data);
        const failedImports = [];
        imports.forEach((result, index) => {
          if (result.status === "rejected") failedImports.push(localOnlyIds[index]);
        });

        if (active) {
          updateFavorites([...mergedIds, ...failedImports]);
          try {
            localStorage.removeItem(FAVORITES_KEY);
          } catch (storageError) {
            console.warn("Unable to clear the guest saved-home cache:", storageError);
          }
        }
      } catch (requestError) {
        if (active) {
          console.error("Unable to sync saved homes:", requestError);
          setError("Saved homes could not sync with your account. Please try again.");
        }
      }
    };

    syncFavorites();
    return () => {
      active = false;
    };
  }, [updateFavorites]);

  const toggleFavorite = useCallback(async (propertyId) => {
    const id = Number(propertyId);
    const currentlySaved = favoriteIdsRef.current.includes(id);
    const token = localStorage.getItem("access_token");
    setError("");

    if (token) {
      try {
        if (currentlySaved) {
          await api.delete(`/favorites/${id}`);
        } else {
          await api.post(`/favorites/${id}`);
        }
      } catch (requestError) {
        // Duplicate saves and repeated deletes are already in the desired state.
        const alreadyApplied = currentlySaved
          ? requestError.response?.status === 404
          : requestError.response?.status === 409;
        if (!alreadyApplied) {
          setError("We couldn't update your saved homes. Please try again.");
          return false;
        }
      }
    }

    updateFavorites(
      currentlySaved
        ? favoriteIdsRef.current.filter((favoriteId) => favoriteId !== id)
        : [...favoriteIdsRef.current, id]
    );
    return true;
  }, [updateFavorites]);

  const clearFavorites = useCallback(async () => {
    if (localStorage.getItem("access_token")) {
      try {
        await api.delete("/favorites");
      } catch {
        setError("Saved homes could not be cleared. Please try again.");
        return false;
      }
    }
    updateFavorites([]);
    return true;
  }, [updateFavorites]);

  return { favoriteIds, toggleFavorite, clearFavorites, error };
}
