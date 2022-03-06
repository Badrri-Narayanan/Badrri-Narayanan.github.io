let score = document.getElementById("scoreVal");
let User = document.getElementById("user");
let Computer = document.getElementById("comp");
let Result = document.getElementById("result");
let comp_optn = ["Rock", "Paper", "Scissors"];

const compute_result_score = () => {
	if (User.innerHTML == Computer.innerHTML) {
		Result.innerHTML = "It's a tie";
	} else if ((User.innerHTML == "Rock" && Computer.innerHTML == "Scissors") 
				|| (User.innerHTML == "Paper" && Computer.innerHTML == "Rock")
				|| (User.innerHTML == "Scissors" && Computer.innerHTML == "Paper")) {
		Result.innerHTML = "You win!"
		score.innerHTML++;
	} else {
		Result.innerHTML = "You lose"
	}
}

const UserInput = (event) => {
	User.innerHTML = event.target.innerHTML;
	comp_ch = Math.floor(Math.random()*3);
	Computer.innerHTML = comp_optn[comp_ch];
	compute_result_score();
}

let choice = document.getElementsByClassName("userChoice");

Array.from(choice, el => el.addEventListener("click", UserInput));