import {
  StyleSheet,
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useState, useRef, useEffect } from "react";

// Map
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

// Image picker
import * as ImagePicker from "expo-image-picker";

// Firebase
import { app, database, storage } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// Notifikationer
import { Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import Toast from "react-native-toast-message";

// Sætter notifications handler til at vise en alert og spille en lyd
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [markers, setMarkers] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [region, setRegion] = useState({
    latitude: 55,
    longitude: 12,
    latitudeDelta: 20,
    longitudeDelta: 20,
  });

  const mapView = useRef(null); // ref til mapview objektet
  const locationSubscription = useRef(null); // når vi lukker appen, skal den ikke lytte mere

  useEffect(() => {
    async function startListening() {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }
      locationSubscription.current = await Location.watchPositionAsync(
        {
          distanceInterval: 100,
          accuracy: Location.Accuracy.High,
        },
        (lokation) => {
          const newRegion = {
            latitude: lokation.coords.latitude,
            longitude: lokation.coords.longitude,
            latitudeDelta: 20,
            longitudeDelta: 20,
          };
          setRegion(newRegion); // Flytter kortet til ny position
          if (mapView.current) {
            mapView.current.animateToRegion(newRegion, 1000);
          }
        }
      );
    }
    startListening();

    // Fetch markers from Firebase database
    async function fetchMarkers() {
      const querySnapshot = await getDocs(collection(database, "markers"));
      const fetchedMarkers = [];
      querySnapshot.forEach((doc) => {
        fetchedMarkers.push({ ...doc.data(), key: doc.id });
      });
      setMarkers(fetchedMarkers);
    }

    fetchMarkers();

    // Lyt til notifikationer i forgrunden
    const foregroundSubscription =
      Notifications.addNotificationReceivedListener((notification) => {
        // Tjek objekt om der er blevet modtaget en notifikation
        // console.log("Notifikation modtaget i forgrund:", notification);

        // Vis en toast-besked
        Toast.show({
          type: "success",
          text1: notification.request.content.title,
          text2: notification.request.content.body,
        });
      });

    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
      // Rens op når komponenten unmountes
      foregroundSubscription.remove();
    };
  }, []);

  async function addMarker(data) {
    try {
      // Extract the coordinates synchronously before any await calls
      const { latitude, longitude } = data.nativeEvent.coordinate;

      // Open image picker
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        // Upload image to Firebase Storage
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const storageRef = ref(storage, `images/${Date.now()}`);
        await uploadBytes(storageRef, blob);

        // Get download URL
        const downloadURL = await getDownloadURL(storageRef);

        // Save marker info to Firestore
        const docRef = await addDoc(collection(database, "markers"), {
          coordinate: { latitude, longitude },
          imageUrl: downloadURL,
        });

        // Update local markers state
        setMarkers((prevMarkers) => [
          ...prevMarkers,
          {
            coordinate: { latitude, longitude },
            key: docRef.id,
            imageUrl: downloadURL,
          },
        ]);

        // Vibration feedback when a new marker is added for 100 ms
        Vibration.vibrate(100);

        // Send notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Ny markør tilføjet",
            body: "En ny markør er blevet oprettet på kortet!",
          },
          trigger: null,
        });
      }
    } catch (error) {
      console.error("Error adding marker: ", error);
    }
  }

  async function deleteMarker(marker) {
    try {
      // Delete image from Firebase Storage
      const imageRef = ref(storage, marker.imageUrl);
      await deleteObject(imageRef);

      // Delete marker from Firestore
      const markerRef = doc(database, "markers", marker.key);
      await deleteDoc(markerRef);

      // Remove marker from local state
      setMarkers((prevMarkers) =>
        prevMarkers.filter((m) => m.key !== marker.key)
      );

      // Close the modal
      setModalVisible(false);

      // Vibration feedback on deletion
      Vibration.vibrate(100);

      // Send notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Markør slettet",
          body: "Valgt markør er blevet slettet fra kortet!",
        },
        trigger: null,
      });
    } catch (error) {
      console.error("Error deleting marker: ", error);
    }
  }

  function onMarkerPress(marker) {
    setSelectedMarker(marker);
    setSelectedImageUrl(marker.imageUrl);
    setModalVisible(true);

    // Vibrate when marker modal opens
    Vibration.vibrate(50);
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region} onLongPress={addMarker}>
        {markers.map((marker) => (
          <Marker
            coordinate={marker.coordinate}
            key={marker.key}
            onPress={() => onMarkerPress(marker)}
          />
        ))}
      </MapView>

      <Toast />

      {/* Modal view for images */}

      <Modal visible={modalVisible} transparent={true}>
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
          {selectedImageUrl && (
            <Image
              source={{ uri: selectedImageUrl }}
              style={styles.modalImage}
            />
          )}
          <TouchableOpacity
            style={styles.modalDeleteButton}
            onPress={() => deleteMarker(selectedMarker)}
          >
            <Text style={styles.modalDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImage: {
    width: 300,
    height: 300,
  },
  modalCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  modalCloseText: {
    color: "#000",
  },
  modalDeleteButton: {
    position: "absolute",
    bottom: 50,
    padding: 10,
    backgroundColor: "#ff4d4d",
    borderRadius: 20,
  },
  modalDeleteText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
