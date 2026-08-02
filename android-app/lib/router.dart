import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/auth_controller.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/shell/main_shell.dart';
import '../screens/home/home_screen.dart';
import '../screens/projects/projects_screen.dart';
import '../screens/projects/project_detail_screen.dart';
import '../screens/projects/new_project_screen.dart';
import '../screens/browse/browse_screen.dart';
import '../screens/messages/messages_screen.dart';
import '../screens/messages/chat_screen.dart';
import '../screens/wallet/wallet_screen.dart';
import '../screens/escrow/escrow_screen.dart';
import '../screens/notifications/notifications_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/admin/admin_screens.dart';
import '../screens/more/more_screen.dart';
import '../screens/talent/talent_screen.dart';
import '../screens/catalog/catalog_screen.dart';
import '../screens/disputes/disputes_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/home',
    refreshListenable: _AuthRefresh(ref),
    redirect: (context, state) {
      if (auth.booting) return null;
      final loggingIn =
          state.matchedLocation == '/login' || state.matchedLocation == '/register';
      if (!auth.isAuthenticated && !loggingIn) return '/login';
      if (auth.isAuthenticated && loggingIn) {
        return auth.user?.isAdmin == true ? '/admin' : '/home';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/home', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/admin', builder: (_, __) => const AdminHomeScreen()),
          GoRoute(path: '/admin/users', builder: (_, __) => const AdminUsersScreen()),
          GoRoute(
            path: '/admin/users/:id',
            builder: (_, state) =>
                AdminUserDetailScreen(userId: state.pathParameters['id']!),
          ),
          GoRoute(path: '/admin/escrows', builder: (_, __) => const AdminEscrowsScreen()),
          GoRoute(
            path: '/admin/withdrawals',
            builder: (_, __) => const AdminWithdrawalsScreen(),
          ),
          GoRoute(path: '/admin/payments', builder: (_, __) => const AdminPaymentsScreen()),
          GoRoute(
            path: '/admin/financials',
            builder: (_, __) => const AdminFinancialsScreen(),
          ),
          GoRoute(path: '/admin/settings', builder: (_, __) => const AdminSettingsScreen()),
          GoRoute(path: '/admin/audit', builder: (_, __) => const AdminAuditScreen()),
          GoRoute(
            path: '/projects',
            builder: (_, __) => const ProjectsScreen(),
            routes: [
              GoRoute(path: 'new', builder: (_, __) => const NewProjectScreen()),
              GoRoute(
                path: ':id',
                builder: (_, state) =>
                    ProjectDetailScreen(projectId: state.pathParameters['id']!),
              ),
            ],
          ),
          GoRoute(path: '/browse', builder: (_, __) => const BrowseScreen()),
          GoRoute(path: '/talent', builder: (_, __) => const TalentScreen()),
          GoRoute(
            path: '/talent/:id',
            builder: (_, state) =>
                SellerProfileScreen(sellerId: state.pathParameters['id']!),
          ),
          GoRoute(path: '/catalog', builder: (_, __) => const CatalogScreen()),
          GoRoute(path: '/favorites', builder: (_, __) => const FavoritesScreen()),
          GoRoute(path: '/disputes', builder: (_, __) => const DisputesScreen()),
          GoRoute(
            path: '/disputes/:id',
            builder: (_, state) =>
                DisputeDetailScreen(disputeId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/messages',
            builder: (_, __) => const MessagesScreen(),
            routes: [
              GoRoute(
                path: ':projectId',
                builder: (_, state) =>
                    ChatScreen(projectId: state.pathParameters['projectId']!),
              ),
            ],
          ),
          GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
          GoRoute(path: '/more', builder: (_, __) => const MoreScreen()),
          GoRoute(
            path: '/notifications',
            builder: (_, __) => const NotificationsScreen(),
          ),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(
            path: '/escrow/:id',
            builder: (_, state) =>
                EscrowScreen(escrowId: state.pathParameters['id']!),
          ),
        ],
      ),
    ],
  );
});

class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(this.ref) {
    ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }
  final Ref ref;
}
