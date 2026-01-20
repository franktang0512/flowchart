var title = "重複幾次";
var title = "重複幾次";
var question = "0練習輸出\n" +
"1四則運算\n" +
"2輸入與變數\n" +
"3服飾店(單一輸入、單一輸出、單一變數、四則運算)\n" +
"4服飾店-改(單一輸入、多輸出、單一變數、四則運算)\n" +

"5記帳(多輸入、單一輸出、單一變數、四則運算)\n" +
"6加法(多輸入、單一輸出、多變數、四則運算)\n" +
"7BMI(多輸入、單一輸出、多變數、四則運算)\n" +

"8網路商城(單一輸入、單一輸出、單變數、四則運算、布林運算、單一條件if)\n" +
"9台鐵團體票(單一輸入、單一輸出、單變數、四則運算、布林運算、兩個條件if/else)\n" +
"10腳踏車(單一輸入、單一輸出、單變數、四則運算、布林運算、兩個條件if/else)\n" +

"11養成遊戲(單一輸入、單一輸出、單變數、布林運算、巢狀條件)\n" +
"12怒氣值(多輸入、單一輸出、多變數、四則運算、布林運算、巢狀條件)\n" +
"13排位獎勵(單一輸入、多輸出、多變數、四則運算、布林運算、巢狀條件)\n" +

"14重複幾次(多輸出、次數迴圈)，scratch要用持續兩秒的積木比較看得出來\n"+
"====================================================================\n";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "",
        output: "Hello Sinyi!\nHello Sinyi!\nHello Sinyi!\nHello Sinyi!\nHello Sinyi!",
        note: ""
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})