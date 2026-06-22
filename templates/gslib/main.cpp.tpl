#include <GSgame.h>

// ゲームクラス
class MyGame : public gslib::Game {
};

// メイン関数
int main() {
    return MyGame().run();
}
