import {
    StyleSheet,
    View,
    Text,
    Image,
    Modal,
    TouchableOpacity,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { app, database, storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, getDocs } from "firebase/firestore";

export default function App() {
    const [markers, setMarkers] = useState([]);
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

        return () => {
            if (locationSubscription.current)
                locationSubscription.current.remove();
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
            }
        } catch (error) {
            console.error("Error adding marker: ", error);
        }
    }

    function onMarkerPress(marker) {
        setSelectedImageUrl(marker.imageUrl);
        setModalVisible(true);
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
});
