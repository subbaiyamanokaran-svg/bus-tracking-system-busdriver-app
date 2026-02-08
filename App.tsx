import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Geolocation from 'react-native-geolocation-service';
import appCheck from '@react-native-firebase/app-check';

// --- Reusable Components ---
const AppButton = ({ onPress, title, isPrimary = true }) => (
  <TouchableOpacity
    style={[styles.button, isPrimary ? styles.primaryButton : styles.secondaryButton]}
    onPress={onPress}>
    <Text style={styles.buttonText}>{title}</Text>
  </TouchableOpacity>
);

const AppInput = ({ value, onChangeText, placeholder, keyboardType = 'default' }) => (
  <TextInput
    style={styles.input}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor="#7f8c8d"
    keyboardType={keyboardType}
  />
);

const SettingsIcon = () => (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#bdc3c7', marginBottom: 2 }} />
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#bdc3c7', marginBottom: 2 }} />
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#bdc3c7' }} />
    </View>
);

const AppLogo = () => (
  <View style={styles.logoContainer}>
    <View style={styles.logoBusBody}>
      <View style={styles.logoBusWindow} />
      <View style={styles.logoWheelsContainer}>
        <View style={styles.logoWheel} />
        <View style={styles.logoWheel} />
      </View>
    </View>
    <Text style={styles.logoText}>DriverApp</Text>
  </View>
);


// --- Screen 1: Phone Authentication ---
const PhoneAuthScreen = () => {
  const [phone, setPhone] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const signInWithPhoneNumber = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirm(confirmation);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    }
    setLoading(false);
  };

  const confirmCode = async () => {
    if (code.length !== 6) {
        Alert.alert('Invalid Code', 'Please enter the 6-digit OTP.');
        return;
    }
    setLoading(true);
    try {
      await confirm.confirm(code);
    } catch (error) {
      console.log('Invalid code.');
      Alert.alert('Error', 'The OTP you entered is invalid.');
    }
    setLoading(false);
  };

  if (loading) {
    return (
        <SafeAreaView style={styles.authContainer}>
            <ActivityIndicator size="large" color="#fff" />
        </SafeAreaView>
    );
  }

  if (!confirm) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <AppLogo />
        <Text style={styles.title}>Driver Sign In</Text>
        <AppInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
        />
        <AppButton title="Send OTP" onPress={signInWithPhoneNumber} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.authContainer}>
      <AppLogo />
      <Text style={styles.title}>Enter OTP</Text>
      <AppInput value={code} onChangeText={setCode} placeholder="6-digit code" keyboardType="number-pad" />
      <AppButton title="Confirm OTP" onPress={confirmCode} />
    </SafeAreaView>
  );
};

// --- Screen 2: Bus Selection (REDESIGNED) ---
const BusSelectionScreen = ({ onBusSelect, onSignOut }) => {
  const [buses, setBuses] = useState([]);
  const [filteredBuses, setFilteredBuses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const subscriber = firestore()
      .collection('buses')
      .onSnapshot(querySnapshot => {
        const busList = [];
        querySnapshot.forEach(documentSnapshot => {
          busList.push({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          });
        });
        setBuses(busList);
        setFilteredBuses(busList);
        setLoading(false);
      });
    return () => subscriber();
  }, []);

  useEffect(() => {
    if (searchQuery === '') {
      setFilteredBuses(buses);
    } else {
      const filtered = buses.filter(bus =>
        bus.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredBuses(filtered);
    }
  }, [searchQuery, buses]);

  const renderBusItem = ({ item }) => (
    <TouchableOpacity style={styles.busCard} onPress={() => onBusSelect(item.id)}>
      <Text style={styles.busCardId}>{item.id}</Text>
      <Text style={styles.busCardModel}>{item.model}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.busSelectionContainer}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Select  YourBus</Text>
        <View style={styles.headerIconsContainer}>
          <TouchableOpacity onPress={() => Alert.alert('Settings', 'Settings screen coming soon!')} style={styles.iconButton}>
             <SettingsIcon />
          </TouchableOpacity>
          <TouchableOpacity onPress={onSignOut} style={styles.iconButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by bus number..."
          placeholderTextColor="#7f8c8d"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredBuses}
          renderItem={renderBusItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.busListContainer}
          ListEmptyComponent={<Text style={styles.noBusesText}>No buses found.</Text>}
        />
      )}
    </View>
  );
};


// --- Screen 3: Tracking (REWRITTEN FOR RELIABILITY) ---
const TrackingScreen = ({ user, busId, onSignOut }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);

  const DRIVER_ID = user.uid;

  // Effect to fetch route info once
  useEffect(() => {
    const fetchRouteInfo = async () => {
      if (!busId) return;
      setLoadingRoute(true);
      try {
        const busDoc = await firestore().collection('buses').doc(busId).get();
        if (!busDoc.exists) throw new Error('Bus not found.');

        const busData = busDoc.data();
        const routeId = busData.routeId;

        if (routeId) {
          const routeDoc = await firestore().collection('routes').doc(routeId).get();
          if (routeDoc.exists) {
            setRouteDetails({ id: routeDoc.id, ...routeDoc.data() });
          } else {
            throw new Error('Route details not found.');
          }
        }
      } catch (error) {
        console.error("Error fetching route info: ", error);
        Alert.alert('Error', 'Could not load route details for this bus.');
      }
      setLoadingRoute(false);
    };

    fetchRouteInfo();
  }, [busId]);

  // Effect to request permission once
  useEffect(() => {
    const requestPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Location Permission',
                        message: 'This app needs access to your location for live tracking.',
                        buttonPositive: 'OK',
                    },
                );
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    console.log('Location permission granted');
                    setHasPermission(true);
                } else {
                    console.log('Location permission denied');
                    setHasPermission(false);
                    Alert.alert("Permission Denied", "Location permission is required for tracking.");
                }
            } catch (err) {
                console.warn(err);
            }
        } else {
            setHasPermission(true); // For iOS, permission is handled differently
        }
    };
    requestPermission();
  }, []);

  // Cleanup effect for when the component unmounts
  useEffect(() => {
    return () => {
      if (watchId) Geolocation.clearWatch(watchId);
    };
  }, [watchId]);

  const updateLocationInFirestore = (currentLocation) => {
    if (!busId || !DRIVER_ID || !routeDetails?.id) {
        console.error("Missing data for Firestore update:", {busId, DRIVER_ID, routeDetails});
        return;
    }
    const { latitude, longitude } = currentLocation.coords;
    firestore()
      .collection('live_trips')
      .doc(busId)
      .set({
        driverId: DRIVER_ID,
        routeId: routeDetails.id,
        lastLocation: new firestore.GeoPoint(latitude, longitude),
        lastUpdated: firestore.FieldValue.serverTimestamp(),
        isActive: true,
      }, { merge: true })
      .then(() => {
          console.log('Location updated:', { latitude, longitude });
          setLocation({latitude, longitude});
      })
      .catch(error => console.error("Firestore Error: ", error));
  };

  const startTracking = () => {
    if (!hasPermission) {
        Alert.alert('Permission Required', 'Please grant location permission to start tracking.');
        return;
    }
    if (!routeDetails) {
        Alert.alert('Cannot Start', 'Route information is not available.');
        return;
    }

    setIsTracking(true);
    // 1. Get current location immediately for the first update
    Geolocation.getCurrentPosition(
      (position) => {
        console.log('Initial position:', position);
        updateLocationInFirestore(position); // Send first update immediately
      },
      (error) => {
        console.log('getCurrentPosition Error:', error.code, error.message);
        Alert.alert("Could not get location", "Please ensure GPS is enabled.");
        setIsTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    // 2. Start watching for continuous updates
    const geoWatchId = Geolocation.watchPosition(
      (position) => {
        console.log('Watched position:', position);
        updateLocationInFirestore(position);
      },
      (error) => {
        console.log('watchPosition Error:', error.code, error.message);
      },
      { enableHighAccuracy: true, distanceFilter: 10, interval: 5000, useSignificantChanges: false },
    );
    setWatchId(geoWatchId);
  };

  const stopTracking = () => {
    if (watchId) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
    setLocation(null);
    firestore().collection('live_trips').doc(busId).update({ isActive: false })
      .then(() => console.log('Trip stopped. isActive set to false.'))
      .catch(error => console.error("Firestore Error on stop: ", error));
  };

  return (
    <SafeAreaView style={[styles.container,{marginTop:40}]}>
      <View style={styles.header}>
        <Text style={styles.busId}>Bus: {busId}</Text>
        <TouchableOpacity onPress={onSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {loadingRoute ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : routeDetails && (
        <View style={styles.routeInfoContainer}>
          <Text style={styles.routeLabel}>ROUTE: {routeDetails.id}</Text>
          <Text style={styles.routeText}>{routeDetails.startPoint} to {routeDetails.endPoint}</Text>
        </View>
      )}

      <View style={styles.locationContainer}>
        <Text style={styles.statusText}>
          Status: {isTracking ? 'Broadcasting Location' : 'Inactive'}
        </Text>
        {location && (
          <Text style={styles.locationText}>
            Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
          </Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {!isTracking ? (
          <TouchableOpacity style={[styles.button, styles.startButton]} onPress={startTracking}>
            <Text style={styles.buttonText}>Start Trip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopTracking}>
            <Text style={styles.buttonText}>End Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};


// --- Main App Component (The Navigator) ---
const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedBus, setSelectedBus] = useState(null);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(currentUser => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, []);

  const handleSignOut = async () => {
    if (user) {
        await auth().signOut();
        setSelectedBus(null);
    }
  };

  if (initializing) {
    return (
      <View style={[styles.fullScreenLoader]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  const renderScreen = () => {
    if (!user) {
      return <PhoneAuthScreen />;
    }
    if (!selectedBus) {
      return <BusSelectionScreen onBusSelect={setSelectedBus} onSignOut={handleSignOut} />;
    }
    return <TrackingScreen user={user} busId={selectedBus} onSignOut={handleSignOut} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2c3e50' }}>
      <StatusBar barStyle="light-content" backgroundColor="#2c3e50" />
      {renderScreen()}
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  fullScreenLoader: {
    flex: 1,
    backgroundColor: '#2c3e50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBusBody: {
    width: 100,
    height: 60,
    backgroundColor: '#3498db',
    borderRadius: 10,
    justifyContent: 'space-between',
    padding: 5,
  },
  logoBusWindow: {
    width: '90%',
    height: 25,
    backgroundColor: '#ecf0f1',
    borderRadius: 5,
    alignSelf: 'center',
  },
  logoWheelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  logoWheel: {
    width: 15,
    height: 15,
    backgroundColor: '#2c3e50',
    borderRadius: 10,
  },
  logoText: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ecf0f1',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#2c3e50',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ecf0f1',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#34495e',
    color: '#ecf0f1',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },

  busSelectionContainer: {
    flex: 1,
    backgroundColor: '#2c3e50',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#34495e',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ecf0f1',
  },
  headerIconsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  iconButton: {
      marginLeft: 20,
      padding: 5,
  },
  searchContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#34495e',
  },
  searchInput: {
    backgroundColor: '#34495e',
    color: '#ecf0f1',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    fontSize: 16,
  },
  busListContainer: {
      paddingHorizontal: 15,
      paddingTop: 10,
  },
  busCard: {
    backgroundColor: '#34495e',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  busCardId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ecf0f1',
  },
  busCardModel: {
    fontSize: 14,
    color: '#bdc3c7',
    marginTop: 4,
  },
  noBusesText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#7f8c8d',
  },

  container: {
    flex: 1,
    backgroundColor: '#2c3e50',
    padding: 20,
  },
  button: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButton: { backgroundColor: '#2980b9' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  signOutText: { color: '#e74c3c', fontSize: 16, fontWeight: 'bold' },
  busId: { fontSize: 18, color: '#bdc3c7' },
  routeInfoContainer: {
    backgroundColor: '#34495e',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,
  },
  routeLabel: {
    fontSize: 16,
    color: '#bdc3c7',
    fontWeight: 'bold',
  },
  routeText: {
    fontSize: 18,
    color: '#ecf0f1',
    marginTop: 5,
  },
  locationContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34495e',
    borderRadius: 10,
    padding: 20,
  },
  statusText: { fontSize: 20, color: '#ecf0f1', fontWeight: '600' },
  locationText: { fontSize: 16, color: '#1abc9c', marginTop: 10 },
  buttonContainer: { width: '100%', alignItems: 'center', marginTop: 20 },
  startButton: { backgroundColor: '#27ae60', width: '80%', padding: 20 },
  stopButton: { backgroundColor: '#c0392b', width: '80%', padding: 20 },
});

export default App;