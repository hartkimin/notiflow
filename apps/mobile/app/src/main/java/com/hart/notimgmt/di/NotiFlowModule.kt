package com.hart.notimgmt.di

import com.hart.notimgmt.data.notiroute.NotiRouteApiClient
import com.hart.notimgmt.data.preferences.AppPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import javax.inject.Named
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NotiRouteModule {

    @Provides
    @Singleton
    @Named("notiroute")
    fun provideNotiRouteHttpClient(): HttpClient {
        return HttpClient(OkHttp) {
            engine {
                config {
                    connectTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                    readTimeout(10, java.util.concurrent.TimeUnit.SECONDS)
                }
            }
        }
    }

    @Provides
    @Singleton
    fun provideNotiRouteApiClient(
        @Named("notiroute") httpClient: HttpClient,
        appPreferences: AppPreferences
    ): NotiRouteApiClient {
        return NotiRouteApiClient(httpClient, appPreferences)
    }
}

