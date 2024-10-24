import { StyleSheet, Text, View } from "react-native";
import { useState, useRef, useEffect } from "react";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

export default function App() {
    const [markers, setMarkers] = useState([]);
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
            let { status } =
                await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                console.log(
                    "Permission to access location was denied"
                );
                return;
            }
            locationSubscription.current =
                await Location.watchPositionAsync(
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
                            mapView.current.animateToRegion(
                                newRegion,
                                1000
                            );
                        }
                    }
                );
        }
        startListening();
        return () => {
            if (locationSubscription.current)
                locationSubscription.current.remove();
        };
    }, []);

    function addMarker(data) {
        const { latitude, longitude } = data.nativeEvent.coordinate;
        const newMarker = {
            coordinate: { latitude, longitude },
            key: data.timeStamp,
            title: "Great place",
        };
        setMarkers([...markers, newMarker]);
    }

    function onMarkerPress(text) {
        alert("You pressed a marker with title: " + text);
    }

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                region={region}
                onLongPress={addMarker}
            >
                {markers.map((marker) => (
                    <Marker
                        coordinate={marker.coordinate}
                        key={marker.key}
                        title={marker.title}
                        onPress={() => onMarkerPress(marker.title)}
                    />
                ))}
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
    map: {
        width: "100%",
        height: "100%",
    },
});
