import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/ai/ai_chat_screen.dart';
import '../features/appointments/appointments_screen.dart';
import '../features/appointments/book_appointment_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/doctor/doctor_home_screen.dart';
import '../features/kyc/kyc_screen.dart';
import '../features/patient/patient_home_screen.dart';
import '../features/profile/profile_screen.dart';
import 'auth/auth_state.dart';

GoRouter buildRouter(AuthState auth) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: auth,
    redirect: (ctx, state) {
      if (!auth.booted) return null;
      final loggedIn = auth.authenticated;
      final goingToLogin = state.matchedLocation == '/login';
      if (!loggedIn && !goingToLogin) return '/login';
      if (loggedIn && goingToLogin) return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: '/',
        builder: (ctx, _) => auth.hasRole('doctor')
            ? const DoctorHomeScreen()
            : const PatientHomeScreen(),
      ),
      GoRoute(path: '/appointments', builder: (_, __) => const AppointmentsScreen()),
      GoRoute(path: '/appointments/book', builder: (_, __) => const BookAppointmentScreen()),
      GoRoute(path: '/kyc', builder: (_, __) => const KycScreen()),
      GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
      GoRoute(path: '/ai', builder: (_, __) => const AiChatScreen()),
    ],
    errorBuilder: (_, state) => Scaffold(body: Center(child: Text('Not found: ${state.uri}'))),
  );
}
