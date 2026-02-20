package com.hart.notimgmt.ui.navigation

import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.hart.notimgmt.data.auth.AuthManager
import com.hart.notimgmt.data.preferences.AppPreferences
import com.hart.notimgmt.ui.dashboard.DashboardScreen
import com.hart.notimgmt.ui.kanban.WeeklyPlannerScreen
import com.hart.notimgmt.ui.login.LoginScreen
import com.hart.notimgmt.ui.message.MessageDetailScreen
import com.hart.notimgmt.ui.message.MessageListScreen
import com.hart.notimgmt.ui.onboarding.OnboardingScreen
import com.hart.notimgmt.ui.chat.AiChatScreen
import com.hart.notimgmt.ui.settings.SettingsScreen
import com.hart.notimgmt.ui.splash.SplashScreen
import com.hart.notimgmt.ui.trash.TrashScreen
import com.hart.notimgmt.ui.theme.TwsTheme

val LocalSnackbarHostState = compositionLocalOf<SnackbarHostState> {
    error("No SnackbarHostState provided")
}

@Composable
fun AppNavigation(
    appPreferences: AppPreferences,
    authManager: AuthManager
) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Routes.SPLASH
    ) {
        composable(Routes.SPLASH) {
            SplashScreen(
                onFinished = {
                    val destination = when {
                        // 온보딩 미완료 -> 온보딩 화면 (최초 설치 시)
                        !appPreferences.isOnboardingCompleted -> Routes.ONBOARDING
                        // 로그인 안됨 -> 로그인 화면
                        !authManager.isLoggedIn -> Routes.LOGIN
                        // 그 외 -> 메인 화면
                        else -> Routes.MAIN
                    }
                    navController.navigate(destination) {
                        popUpTo(Routes.SPLASH) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                onComplete = {
                    appPreferences.isOnboardingCompleted = true
                    // 온보딩 완료 후 로그인 화면으로
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.LOGIN) {
            LoginScreen(
                authManager = authManager,
                appPreferences = appPreferences,
                onLoginSuccess = {
                    // 로그인 성공 후 메인 화면으로
                    navController.navigate(Routes.MAIN) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.MAIN) {
            MainScreen(
                onLogout = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.MAIN) { inclusive = true }
                    }
                }
            )
        }
    }
}

@Composable
fun MainScreen(onLogout: () -> Unit = {}) {
    val navController = rememberNavController()
    val tabs = listOf(Screen.Dashboard, Screen.Messages, Screen.AiChat, Screen.Kanban, Screen.Settings)
    val snackbarHostState = remember { SnackbarHostState() }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val isDetailScreen = currentDestination?.route?.startsWith("message_detail") == true
    val isAppChatScreen = currentDestination?.route?.startsWith("app_chat") == true
    val isTrashScreen = currentDestination?.route == Routes.TRASH
    val isAiChat = currentDestination?.route == Screen.AiChat.route
    val density = LocalDensity.current
    val imeVisible = WindowInsets.ime.getBottom(density) > 0
    val hideBottomBar = isDetailScreen || isTrashScreen || isAppChatScreen || (isAiChat && imeVisible)

    CompositionLocalProvider(LocalSnackbarHostState provides snackbarHostState) {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
            contentWindowInsets = WindowInsets(0, 0, 0, 0),
            bottomBar = {
                if (!hideBottomBar) {
                    BottomNavBar(navController = navController, tabs = tabs)
                }
            }
        ) { innerPadding ->
            MainNavHost(
                navController = navController,
                modifier = Modifier.padding(
                    bottom = if (hideBottomBar) 0.dp else innerPadding.calculateBottomPadding()
                ),
                onLogout = onLogout
            )
        }
    }
}

@Composable
private fun BottomNavBar(navController: NavHostController, tabs: List<Screen>) {
    val glassColors = TwsTheme.glassColors

    Surface(
        modifier = Modifier
            .shadow(
                elevation = 16.dp,
                ambientColor = glassColors.shadow,
                spotColor = glassColors.shadow
            ),
        color = glassColors.surface,
        border = BorderStroke(1.dp, glassColors.border)
    ) {
        NavigationBar(
            containerColor = Color.Transparent,
            tonalElevation = 0.dp
        ) {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination
            tabs.forEach { screen ->
                // Messages 탭은 route에 파라미터가 있으므로 BASE_ROUTE로 비교
                val baseRoute = when (screen) {
                    is Screen.Messages -> Screen.Messages.BASE_ROUTE
                    else -> screen.route
                }
                val selected = currentDestination?.hierarchy?.any {
                    it.route?.startsWith(baseRoute) == true
                } == true
                NavigationBarItem(
                    icon = {
                        Icon(
                            screen.icon,
                            contentDescription = screen.label
                        )
                    },
                    label = {
                        Text(
                            screen.label,
                            style = MaterialTheme.typography.labelSmall
                        )
                    },
                    selected = selected,
                    onClick = {
                        // Messages 탭 클릭 시 필터 없이 이동
                        val targetRoute = when (screen) {
                            is Screen.Messages -> Screen.Messages.createRoute(null)
                            else -> screen.route
                        }
                        navController.navigate(targetRoute) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.primary,
                        selectedTextColor = MaterialTheme.colorScheme.primary,
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                    )
                )
            }
        }
    }
}

@Composable
private fun MainNavHost(navController: NavHostController, modifier: Modifier = Modifier, onLogout: () -> Unit = {}) {
    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route,
        modifier = modifier
    ) {
        composable(
            Screen.Dashboard.route,
            enterTransition = { fadeIn(tween(200)) },
            exitTransition = { fadeOut(tween(200)) }
        ) {
            DashboardScreen(
                onNavigateToChat = { source, sender ->
                    navController.navigate("app_chat/${android.net.Uri.encode(source)}/${android.net.Uri.encode(sender)}")
                }
            )
        }
        composable(
            route = "app_chat/{source}/{sender}",
            arguments = listOf(
                navArgument("source") { type = NavType.StringType },
                navArgument("sender") { type = NavType.StringType }
            ),
            enterTransition = { slideInHorizontally(tween(300)) { it } + fadeIn(tween(300)) },
            exitTransition = { slideOutHorizontally(tween(300)) { it } + fadeOut(tween(300)) }
        ) { backStackEntry ->
            val source = backStackEntry.arguments?.getString("source") ?: ""
            val sender = backStackEntry.arguments?.getString("sender") ?: ""
            com.hart.notimgmt.ui.chat.AppChatScreen(
                source = source,
                sender = sender,
                onBack = { navController.popBackStack() },
                onMessageClick = { messageId ->
                    navController.navigate(Routes.messageDetail(messageId))
                }
            )
        }
        composable(
            route = Screen.Messages.route,
            arguments = listOf(
                navArgument("statusFilter") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                },
                navArgument("completedToday") {
                    type = NavType.StringType
                    nullable = true
                    defaultValue = null
                }
            ),
            enterTransition = { fadeIn(tween(200)) },
            exitTransition = { fadeOut(tween(200)) }
        ) { backStackEntry ->
            val statusFilter = backStackEntry.arguments?.getString("statusFilter")
            val completedToday = backStackEntry.arguments?.getString("completedToday") == "true"
            MessageListScreen(
                navController = navController,
                initialStatusFilter = statusFilter,
                initialCompletedTodayFilter = completedToday
            )
        }
        composable(
            Screen.AiChat.route,
            enterTransition = { fadeIn(tween(200)) },
            exitTransition = { fadeOut(tween(200)) }
        ) { AiChatScreen() }
        composable(
            Screen.Kanban.route,
            enterTransition = { fadeIn(tween(200)) },
            exitTransition = { fadeOut(tween(200)) }
        ) {
            WeeklyPlannerScreen(
                onMessageClick = { messageId ->
                    navController.navigate(Routes.messageDetail(messageId))
                }
            )
        }
        composable(
            Screen.Settings.route,
            enterTransition = { fadeIn(tween(200)) },
            exitTransition = { fadeOut(tween(200)) }
        ) { SettingsScreen(onLogout = onLogout) }
        composable(
            Routes.TRASH,
            enterTransition = { slideInHorizontally(tween(300)) { it } + fadeIn(tween(300)) },
            exitTransition = { slideOutHorizontally(tween(300)) { it } + fadeOut(tween(300)) }
        ) {
            TrashScreen(
                onMessageClick = { messageId ->
                    navController.navigate(Routes.messageDetail(messageId))
                },
                onBack = { navController.popBackStack() }
            )
        }
        composable(
            route = Routes.MESSAGE_DETAIL,
            arguments = listOf(navArgument("messageId") { type = NavType.StringType }),
            enterTransition = { slideInHorizontally(tween(300)) { it } + fadeIn(tween(300)) },
            exitTransition = { slideOutHorizontally(tween(300)) { it } + fadeOut(tween(300)) }
        ) { backStackEntry ->
            val messageId = backStackEntry.arguments?.getString("messageId") ?: ""
            MessageDetailScreen(
                messageId = messageId,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
